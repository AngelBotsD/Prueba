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
const SKY_KEY = process.env.API_KEY || "Russellxz"

const pending = {}
const cache = {}
const MAX_CONCURRENT = 3
let activeDownloads = 0
const downloadQueue = []

function safeUnlink(file) {
  if (!file) return
  try { fs.existsSync(file) && fs.unlinkSync(file) } catch {}
}

function fileSizeMB(filePath) {
  try { return fs.statSync(filePath).size / (1024 * 1024) } catch { return 0 }
}

function validCache(file) {
  try { return fs.existsSync(file) && fs.statSync(file).size > 15000 } catch { return false }
}

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

async function wait(ms) {
  return new Promise(res => setTimeout(res, ms))
}

async function getSkyApiUrl(videoUrl, format, timeout = 20000, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data } = await axios.get(`${SKY_BASE}/api/download/yt.php`, {
        params: { url: videoUrl, format },
        headers: { Authorization: `Bearer ${SKY_KEY}` },
        timeout
      })
      const result = data?.data || data
      const url = result?.audio || result?.video || result?.url || result?.download
      if (url && url.startsWith("http")) return url
    } catch {}
    if (attempt < retries) await wait(1000)
  }
  return null
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

async function downloadWithResume(url, filePath, signal, start = 0, timeout = 60000) {
  const headers = {}
  if (start > 0) headers.Range = `bytes=${start}-`
  const res = await axios.get(url, {
    responseType: "stream",
    timeout,
    headers: Object.assign({ "User-Agent": "Mozilla/5.0 (WhatsAppBot)" }, headers),
    signal
  })
  const writeStream = fs.createWriteStream(filePath, { flags: start > 0 ? "a" : "w" })
  await streamPipe(res.data, writeStream)
  return filePath
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
      await queueDownload(() => downloadWithResume(mediaUrl, file, controller.signal, start))
      if (key.startsWith("audio") && path.extname(file) !== ".mp3") {
        const mp3 = await convertToMp3(file)
        info.file = mp3
      }
      if (!validCache(info.file)) {
        safeUnlink(info.file)
        throw new Error("archivo inválido después de descargar")
      }
      info.status = "done"
      info.file = info.file
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
      await queueDownload(() => downloadWithResume(mediaUrl, t.file, controller.signal, start))
      if (key.startsWith("audio") && path.extname(t.file) !== ".mp3") {
        const mp3 = await convertToMp3(t.file)
        t.file = mp3
      }
      if (!validCache(t.file)) {
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

async function prepareFormatsPriority(videoUrl) {
  const id = videoUrl
  cache[id] = cache[id] || { timestamp: Date.now(), files: {} }
  const mediaAudioUrl = await getSkyApiUrl(videoUrl, "audio", 20000, 1)
  if (mediaAudioUrl) {
    try {
      await startDownload(videoUrl, "audio", mediaAudioUrl)
      const audioFile = downloadTasks[videoUrl]?.audio?.file
      if (audioFile && validCache(audioFile)) cache[id].files.audio = audioFile
    } catch {}
  }
  const mediaVideoUrl = await getSkyApiUrl(videoUrl, "video", 20000, 1)
  if (mediaVideoUrl) {
    try {
      startDownload(videoUrl, "video", mediaVideoUrl)
      .then(f => {
        if (f && validCache(f)) {
          cache[id].files.video = f
          cache[id].timestamp = Date.now()
        }
      }).catch(() => {})
    } catch {}
  }
  cache[id].timestamp = Date.now()
}

async function sendFile(conn, chatId, filePath, title, asDocument, type, quoted) {
  if (!validCache(filePath)) return
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
    return sendFile(conn, job.chatId, cached, job.title, isDoc, type, job.commandMsg)
  }
  const tasks = downloadTasks[id] || {}
  if (type === "video" && tasks.audio && tasks.audio.status === "downloading") {
    pauseDownload(id, "audio")
    const mediaVideoUrl = await getSkyApiUrl(id, "video", 40000, 1)
    if (!mediaVideoUrl) {
      await resumeDownload(id, "audio", await getSkyApiUrl(id, "audio", 20000, 1))
      return conn.sendMessage(job.chatId, { text: "❌ No se pudo obtener video, reanudando audio..." }, { quoted: job.commandMsg })
    }
    try {
      await resumeDownload(id, "video", mediaVideoUrl)
      const videoFile = downloadTasks[id].video.file
      if (videoFile && validCache(videoFile)) {
        cache[id] = cache[id] || { timestamp: Date.now(), files: {} }
        cache[id].files.video = videoFile
        cache[id].timestamp = Date.now()
        const size = fileSizeMB(videoFile).toFixed(1)
        await conn.sendMessage(job.chatId, { text: `⚡ Enviando video (${size} MB)` }, { quoted: job.commandMsg })
        await sendFile(conn, job.chatId, videoFile, job.title, isDoc, "video", job.commandMsg)
        const mediaAudioUrl = await getSkyApiUrl(id, "audio", 20000, 1)
        if (mediaAudioUrl) resumeDownload(id, "audio", mediaAudioUrl).catch(() => {})
        return
      }
    } catch (err) {
      await conn.sendMessage(job.chatId, { text: `❌ Error video: ${err.message}` }, { quoted: job.commandMsg })
      const mediaAudioUrl = await getSkyApiUrl(id, "audio", 20000, 1)
      if (mediaAudioUrl) resumeDownload(id, "audio", mediaAudioUrl).catch(() => {})
      return
    }
  }
  if (type === "audio") {
    if (tasks.audio && tasks.audio.status === "downloading") {
      await conn.sendMessage(job.chatId, { text: `⏳ Descargando audio...` }, { quoted: job.commandMsg })
      try {
        const f = await tasks.audio.promise
        if (f && validCache(f)) {
          cache[id] = cache[id] || { timestamp: Date.now(), files: {} }
          cache[id].files.audio = f
          cache[id].timestamp = Date.now()
          const size = fileSizeMB(f).toFixed(1)
          await conn.sendMessage(job.chatId, { text: `⚡ Enviando audio (${size} MB)` }, { quoted: job.commandMsg })
          return sendFile(conn, job.chatId, f, job.title, isDoc, "audio", job.commandMsg)
        }
      } catch {}
    }
    const mediaAudioUrl = await getSkyApiUrl(id, "audio", 40000, 1)
    if (!mediaAudioUrl) return conn.sendMessage(job.chatId, { text: "❌ No se obtuvo enlace de audio" }, { quoted: job.commandMsg })
    try {
      const f = await startDownload(id, "audio", mediaAudioUrl)
      if (f && validCache(f)) {
        cache[id] = cache[id] || { timestamp: Date.now(), files: {} }
        cache[id].files.audio = downloadTasks[id].audio.file
        cache[id].timestamp = Date.now()
        const size = fileSizeMB(f).toFixed(1)
        await conn.sendMessage(job.chatId, { text: `⚡ Enviando audio (${size} MB)` }, { quoted: job.commandMsg })
        return sendFile(conn, job.chatId, f, job.title, isDoc, "audio", job.commandMsg)
      }
    } catch (err) {
      return conn.sendMessage(job.chatId, { text: `❌ Error: ${err.message}` }, { quoted: job.commandMsg })
    }
  }
  const mediaVideoUrl2 = await getSkyApiUrl(id, "video", 40000, 1)
  if (!mediaVideoUrl2) return conn.sendMessage(job.chatId, { text: "❌ No se obtuvo enlace de video" }, { quoted: job.commandMsg })
  try {
    const f = await startDownload(id, "video", mediaVideoUrl2)
    if (f && validCache(f)) {
      cache[id] = cache[id] || { timestamp: Date.now(), files: {} }
      cache[id].files.video = downloadTasks[id].video.file
      cache[id].timestamp = Date.now()
      const size = fileSizeMB(f).toFixed(1)
      await conn.sendMessage(job.chatId, { text: `⚡ Enviando video (${size} MB)` }, { quoted: job.commandMsg })
      return sendFile(conn, job.chatId, f, job.title, isDoc, "video", job.commandMsg)
    }
  } catch (err) {
    return conn.sendMessage(job.chatId, { text: `❌ Error: ${err.message}` }, { quoted: job.commandMsg })
  }
}

const handler = async (msg, { conn, text, command }) => {
  const pref = global.prefixes?.[0] || "."

  if (command === "clean") {
    let deleted = 0, freed = 0
    const now = Date.now()

    for (const [videoUrl, data] of Object.entries(cache)) {
      if (now - data.timestamp > 7 * 24 * 60 * 60 * 1000) {
        for (const f of Object.values(data.files)) {
          if (validCache(f)) {
            freed += fs.statSync(f).size
            safeUnlink(f)
            deleted++
          }
        }
        delete cache[videoUrl]
      }
    }

    const files = fs.readdirSync(TMP_DIR).map(f => path.join(TMP_DIR, f))
    for (const f of files) {
      try {
        const stats = fs.statSync(f)
        if (now - stats.mtimeMs > 7 * 24 * 60 * 60 * 1000) {
          freed += stats.size
          safeUnlink(f)
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

  await conn.sendMessage(msg.key.remoteJid, { react: { text: "⏳", key: msg.key } })

  let res
  try { res = await yts(text) }
  catch { return conn.sendMessage(msg.key.remoteJid, { text: "❌ Error al buscar video." }, { quoted: msg }) }

  const video = res.videos?.[0]
  if (!video) {
    return conn.sendMessage(msg.key.remoteJid, { text: "❌ Sin resultados." }, { quoted: msg })
  }

  const { url: videoUrl, title, timestamp: duration, views, author, thumbnail } = video
  const caption = `
𝚂𝚄𝙿𝙴𝚁 𝙿𝙻𝙰𝚈
🎵 𝚃𝚒́𝚝𝚞𝚕𝚘: ${title}
🕑 𝙳𝚞𝚛𝚊𝚌𝚒́𝚘𝚗: ${duration}
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

  prepareFormatsPriority(videoUrl)

  // Borra el pending después de 10 minutos
  setTimeout(() => {
    delete pending[preview.key.id]
  }, 10 * 60 *