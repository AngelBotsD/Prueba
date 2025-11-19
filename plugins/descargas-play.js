import axios from "axios"
import yts from "yt-search"
import fs from "fs"
import path from "path"
import ffmpeg from "fluent-ffmpeg"
import { promisify } from "util"
import { pipeline } from "stream"
import crypto from "crypto"

const streamPipe = promisify(pipeline)
const TMP_DIR = path.join(process.cwd(), "tmp")
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })

const SKY_BASE = process.env.API_BASE || "https://api-sky.ultraplus.click"
const SKY_KEY = process.env.API_KEY || "Neveloopp"

const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT) || 3
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB) || 99
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const DOWNLOAD_TIMEOUT = Number(process.env.DOWNLOAD_TIMEOUT) || 60000

const pending = {}
const cache = {}
let activeDownloads = 0
const downloadQueue = []

function safeUnlink(file) {
  if (!file) return
  try { fs.existsSync(file) && fs.unlinkSync(file) } catch {}
}
function safeStat(file) {
  try { return fs.statSync(file) } catch { return null }
}
function fileSizeMB(filePath) {
  const st = safeStat(filePath)
  return st ? st.size / (1024 * 1024) : 0
}
function readHeader(file, length = 16) {
  try {
    const fd = fs.openSync(file, "r")
    const buf = Buffer.alloc(length)
    fs.readSync(fd, buf, 0, length, 0)
    fs.closeSync(fd)
    return buf
  } catch {
    return null
  }
}
function validCache(file, expectedSize = null) {
  try {
    if (!file) return false
    if (!fs.existsSync(file)) return false
    const stats = fs.statSync(file)
    const size = stats.size
    if (size < 50 * 1024) return false
    if (expectedSize && expectedSize > 0) {
      if (size < expectedSize * 0.92) return false
    }
    const header = readHeader(file, 16)
    if (!header) return false
    const hex = header.toString("hex")
    if (file.endsWith(".mp3")) {
      const startsID3 = hex.startsWith("494433")
      const startsMPEG = hex.startsWith("fff") || hex.startsWith("fffb") || hex.startsWith("fff3")
      if (!startsID3 && !startsMPEG) return false
    }
    if (file.endsWith(".mp4") || file.endsWith(".m4a")) {
      if (!hex.includes("66747970")) return false
    }
    return true
  } catch {
    return false
  }
}
async function wait(ms) { return new Promise(res => setTimeout(res, ms)) }

async function queueDownload(task) {
  if (activeDownloads >= MAX_CONCURRENT) {
    await new Promise(resolve => downloadQueue.push(resolve))
  }
  activeDownloads++
  try { return await task() }
  finally {
    activeDownloads--
    if (downloadQueue.length) downloadQueue.shift()()
  }
}

async function getSkyApiUrl(videoUrl, format, timeout = 20000, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data } = await axios.get(`${SKY_BASE}/api/download/yt.php`, {
        params: { url: videoUrl, format },
        headers: { Authorization: `Bearer ${SKY_KEY}` },
        timeout
      })
      const result = data?.data || data
      const url = result?.audio || result?.video || result?.url || result?.download
      if (typeof url === "string" && url.startsWith("http")) return url
    } catch {}
    if (attempt < retries) await wait(500 * (attempt + 1))
  }
  return null
}

async function probeRemote(url, timeout = 10000) {
  try {
    const res = await axios.head(url, { timeout, maxRedirects: 5 })
    const size = res.headers["content-length"] ? Number(res.headers["content-length"]) : null
    const acceptRanges = !!res.headers["accept-ranges"]
    return { ok: true, size, acceptRanges, headers: res.headers }
  } catch {
    return { ok: false }
  }
}

async function downloadWithResume(url, filePath, signal, start = 0, timeout = DOWNLOAD_TIMEOUT) {
  const headers = {}
  if (start > 0) headers.Range = `bytes=${start}-`
  const res = await axios.get(url, {
    responseType: "stream",
    timeout,
    headers: Object.assign({ "User-Agent": "Mozilla/5.0 (WhatsAppBot)" }, headers),
    signal,
    maxRedirects: 5
  })
  const writeStream = fs.createWriteStream(filePath, { flags: start > 0 ? "a" : "w" })
  await streamPipe(res.data, writeStream)
  return filePath
}

async function convertToMp3(inputFile) {
  const outFile = inputFile.replace(path.extname(inputFile), ".mp3")
  await new Promise((resolve, reject) =>
    ffmpeg(inputFile)
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .format("mp3")
      .on("end", resolve)
      .on("error", reject)
      .save(outFile)
  )
  safeUnlink(inputFile)
  return outFile
}

const downloadTasks = {}
function ensureTask(videoUrl) {
  if (!downloadTasks[videoUrl]) downloadTasks[videoUrl] = {}
  return downloadTasks[videoUrl]
}

async function startDownload(videoUrl, key, mediaUrl) {
  const tasks = ensureTask(videoUrl)
  if (tasks[key]?.status === "done") return tasks[key].file
  if (tasks[key]?.status === "downloading") return tasks[key].promise

  const ext = key.startsWith("audio") ? "mp3" : "mp4"
  const unique = crypto.randomUUID()
  const file = path.join(TMP_DIR, `${unique}_${key}.${ext}`)
  const controller = new AbortController()
  const info = { file, status: "downloading", controller, promise: null }

  info.promise = (async () => {
    try {
      let start = 0
      if (fs.existsSync(file)) start = fs.statSync(file).size

      let expectedSize = null
      const probe = await probeRemote(mediaUrl)
      if (probe.ok && probe.size) expectedSize = probe.size

      await queueDownload(() => downloadWithResume(mediaUrl, file, controller.signal, start))

      if (key.startsWith("audio") && path.extname(file) !== ".mp3") {
        const mp3 = await convertToMp3(file)
        info.file = mp3
      }

      if (!validCache(info.file, expectedSize)) {
        safeUnlink(info.file)
        throw new Error("archivo inválido después de descargar")
      }

      const mb = fileSizeMB(info.file)
      if (mb > MAX_FILE_MB) {
        safeUnlink(info.file)
        throw new Error(`Archivo demasiado grande (${mb.toFixed(1)} MB)`)
      }

      info.status = "done"
      return info.file
    } catch (err) {
      if (err.name === "CanceledError" || err.message === "canceled") {
        info.status = "paused"
        return info.file
      }
      info.status = "error"
      safeUnlink(info.file)
      throw err
    }
  })()

  tasks[key] = info
  return info.promise
}

function pauseDownload(videoUrl, key) {
  const tasks = downloadTasks[videoUrl]
  if (!tasks || !tasks[key]) return
  const t = tasks[key]
  if (t.status === "downloading" && t.controller) {
    try { t.controller.abort() } catch {}
    t.status = "paused"
  }
}

async function resumeDownload(videoUrl, key, mediaUrl) {
  const tasks = ensureTask(videoUrl)
  const t = tasks[key]
  if (!t) return startDownload(videoUrl, key, mediaUrl)
  if (t.status === "done") return t.file
  if (t.status === "downloading") return t.promise

  const controller = new AbortController()
  t.controller = controller
  t.status = "downloading"
  t.promise = (async () => {
    try {
      let start = 0
      if (fs.existsSync(t.file)) start = fs.statSync(t.file).size

      let expectedSize = null
      const probe = await probeRemote(mediaUrl)
      if (probe.ok && probe.size) expectedSize = probe.size

      await queueDownload(() => downloadWithResume(mediaUrl, t.file, controller.signal, start))

      if (key.startsWith("audio") && path.extname(t.file) !== ".mp3") {
        const mp3 = await convertToMp3(t.file)
        t.file = mp3
      }

      if (!validCache(t.file, expectedSize)) {
        safeUnlink(t.file)
        throw new Error("archivo inválido al reanudar")
      }

      t.status = "done"
      return t.file
    } catch (err) {
      if (err.name === "CanceledError" || err.message === "canceled") {
        t.status = "paused"
        return t.file
      }
      t.status = "error"
      safeUnlink(t.file)
      throw err
    }
  })()
  return t.promise
}

async function sendFileToChat(conn, chatId, filePath, title, asDocument, type, quoted) {
  if (!validCache(filePath)) {
    try { await conn.sendMessage(chatId, { text: "❌ Archivo inválido o no disponible." }, { quoted }) } catch {}
    return
  }
  const buffer = fs.readFileSync(filePath)
  const mimetype = type === "audio" ? "audio/mpeg" : "video/mp4"
  const fileName = `${title}.${type === "audio" ? "mp3" : "mp4"}`
  await conn.sendMessage(chatId, {
    [asDocument ? "document" : type]: buffer,
    mimetype,
    fileName
  }, { quoted })
}

async function handleDownload(conn, job, choice) {
  const mapping = { "👍": "audio", "❤️": "video", "📄": "audioDoc", "📁": "videoDoc" }
  const key = mapping[choice]
  if (!key) return
  const isDoc = key.endsWith("Doc")
  const type = key.startsWith("audio") ? "audio" : "video"
  const id = job.videoUrl

  const cached = cache[id]?.files?.[key]
  if (cached && validCache(cached)) {
    const size = fileSizeMB(cached).toFixed(1)
    await conn.sendMessage(job.chatId, { text: `⚡ Enviando ${type} (${size} MB)` }, { quoted: job.commandMsg })
    cache[id].timestamp = Date.now()
    return sendFileToChat(conn, job.chatId, cached, job.title, isDoc, type, job.commandMsg)
  }

  const mediaUrl = await getSkyApiUrl(id, type, 40000, 2)
  if (!mediaUrl) return conn.sendMessage(job.chatId, { text: `❌ No se obtuvo enlace de ${type}` }, { quoted: job.commandMsg })

  const probe = await probeRemote(mediaUrl)
  if (!probe.ok) return conn.sendMessage(job.chatId, { text: `❌ No se puede acceder al recurso remoto.` }, { quoted: job.commandMsg })
  if (probe.size && probe.size / (1024 * 1024) > MAX_FILE_MB) {
    return conn.sendMessage(job.chatId, { text: `❌ Archivo muy grande (${(probe.size/(1024*1024)).toFixed(1)}MB).` }, { quoted: job.commandMsg })
  }

  try {
    await conn.sendMessage(job.chatId, { text: `⏳ Iniciando descarga de ${type}...` }, { quoted: job.commandMsg })
    const f = await startDownload(id, key, mediaUrl)
    if (f && validCache(f)) {
      cache[id] = cache[id] || { timestamp: Date.now(), files: {} }
      cache[id].files[key] = f
      cache[id].timestamp = Date.now()
      const size = fileSizeMB(f).toFixed(1)
      await conn.sendMessage(job.chatId, { text: `⚡ Enviando ${type} (${size} MB)` }, { quoted: job.commandMsg })
      return sendFileToChat(conn, job.chatId, f, job.title, isDoc, type, job.commandMsg)
    } else {
      return conn.sendMessage(job.chatId, { text: `❌ Descarga completada pero archivo inválido.` }, { quoted: job.commandMsg })
    }
  } catch (err) {
    return conn.sendMessage(job.chatId, { text: `❌ Error: ${err?.message || err}` }, { quoted: job.commandMsg })
  }
}

const handler = async (msg, { conn, text, command }) => {
  const pref = global.prefixes?.[0] || "."

  if (command === "clean") {
    let deleted = 0, freed = 0

    for (const [videoUrl, data] of Object.entries(cache)) {
      for (const f of Object.values(data.files)) {
        try {
          if (fs.existsSync(f)) {
            freed += fs.statSync(f).size
            safeUnlink(f)
            deleted++
          }
        } catch {}
      }
      delete cache[videoUrl]
    }

    const files = fs.readdirSync(TMP_DIR)
    for (const f of files) {
      try {
        const full = path.join(TMP_DIR, f)
        if (fs.existsSync(full)) {
          const stats = fs.statSync(full)
          freed += stats.size
          safeUnlink(full)
          deleted++
        }
      } catch {}
    }

    const mb = (freed / (1024 * 1024)).toFixed(2)
    return conn.sendMessage(msg.chat, { text: `🧹 Limpieza PRO\nEliminados: ${deleted}\nEspacio liberado: ${mb} MB` }, { quoted: msg })
  }

  if (!text?.trim()) {
    return conn.sendMessage(msg.key.remoteJid, {
      text: `✳️ Usa:\n${pref}play <término>\nEj: *${pref}play* bad bunny diles`
    }, { quoted: msg })
  }

  try { await conn.sendMessage(msg.key.remoteJid, { react: { text: "⏳", key: msg.key } }) } catch {}

  let res
  try { res = await yts(text) }
  catch { return conn.sendMessage(msg.key.remoteJid, { text: "❌ Error al buscar video." }, { quoted: msg }) }

  const video = res.videos?.[0]
  if (!video) return conn.sendMessage(msg.key.remoteJid, { text: "❌ Sin resultados." }, { quoted: msg })

  const { url: videoUrl, title, timestamp: duration, views, author, thumbnail } = video
  const caption = `
𝚂𝚄𝙿𝙴𝚁 𝙿𝙻𝙰𝚈
🎵 𝚃𝚒́𝚝𝚞𝚕𝚘: ${title}
🕑 𝙳𝚞𝚛𝚊𝚌𝚒𝚘́𝚗: ${duration}
👁️‍🗨️ 𝚅𝚒𝚜𝚝𝚊𝚜: ${(views || 0).toLocaleString()}
🎤 𝙰𝚛𝚝𝚒𝚜𝚝𝚊: ${author?.name || author || "Desconocido"}
🌐 𝙻𝚒𝚗𝚔: ${videoUrl}

📥 Reacciona para descargar:
☛ 👍 Audio MP3
☛ ❤️ Video MP4
☛ 📄 Audio Doc
☛ 📁 Video Doc
`.trim()

  const preview = await conn.sendMessage(msg.key.remoteJid, { image: { url: thumbnail }, caption }, { quoted: msg })

  pending[preview.key.id] = {
    chatId: msg.key.remoteJid,
    videoUrl,
    title,
    commandMsg: msg,
    sender: msg.key.participant || msg.participant,
    downloading: false
  }

  setTimeout(() => delete pending[preview.key.id], 10 * 60 * 1000)
  try { await conn.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } }) } catch {}

  if (!conn._listeners) conn._listeners = {}
  if (!conn._listeners.play) {
    conn._listeners.play = true
    conn.ev.on("messages.upsert", async ev => {
      for (const m of ev.messages || []) {
        const react = m.message?.reactionMessage
        if (!react) continue
        const { key: reactKey, text: emoji, sender } = react
        const job = pending[reactKey?.id]
        if (!job || !["👍","❤️","📄","📁"].includes(emoji)) continue
        if ((sender || m.key.participant) !== job.sender) {
          await conn.sendMessage(job.chatId, { text: "❌ No autorizado." }, { quoted: job.commandMsg })
          continue
        }
        if (job.downloading) continue
        job.downloading = true
        const mapping = { "👍": "audio", "❤️": "video", "📄": "audioDoc", "📁": "videoDoc" }
        const type = mapping[emoji]?.startsWith("audio") ? "audio" : "video"
        try {
          await conn.sendMessage(job.chatId, { text: `⏳ Descargando ${type}...` }, { quoted: job.commandMsg })
        } catch {}
        try { await handleDownload(conn, job, emoji) } finally { job.downloading = false }
      }
    })
  }
}

handler.command = ["play","clean"]
export default handler