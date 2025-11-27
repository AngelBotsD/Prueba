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

const CACHE_FILE = path.join(TMP_DIR, "cache.json")
const SKY_BASE = process.env.API_BASE || "https://api-sky.ultraplus.click"
const SKY_KEY = process.env.API_KEY || "Russellxz"
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT) || 3
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB) || 99
const DOWNLOAD_TIMEOUT = Number(process.env.DOWNLOAD_TIMEOUT) || 60000
const MAX_RETRIES = 3
const CACHE_TTL = 1000 * 60 * 60 * 24 * 7

let activeDownloads = 0
const downloadQueue = []
const downloadTasks = {}
let cache = loadCache()

function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache))
  } catch {}
}

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, "utf8")
      const parsed = JSON.parse(raw || "{}")
      const now = Date.now()
      for (const id of Object.keys(parsed)) {
        const item = parsed[id]
        if (!item || !item.timestamp || now - item.timestamp > CACHE_TTL) {
          delete parsed[id]
          continue
        }
        if (item.files) {
          for (const k of Object.keys(item.files)) {
            const f = item.files[k]
            if (!f || !fs.existsSync(f)) {
              delete item.files[k]
            }
          }
        }
      }
      saveCache()
      return parsed
    }
  } catch {}
  return {}
}

function safeUnlink(file) {
  try {
    file && fs.existsSync(file) && fs.unlinkSync(file)
  } catch {}
}

function fileSizeMB(filePath) {
  try {
    return fs.statSync(filePath).size / (1024 * 1024)
  } catch {
    return 0
  }
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

function wait(ms) {
  return new Promise(res => setTimeout(res, ms))
}

function validCache(file, expectedSize = null) {
  if (!file || !fs.existsSync(file)) return false
  try {
    const size = fs.statSync(file).size
    if (size < 501024) return false
    if (expectedSize && size < expectedSize * 0.92) return false
    const buf = readHeader(file, 16)
    if (!buf) return false
    const hex = buf.toString("hex")
    if (file.endsWith(".mp3") && !(hex.startsWith("494433") || hex.startsWith("fff"))) return false
    if ((file.endsWith(".mp4") || file.endsWith(".m4a")) && !hex.includes("66747970")) return false
    return true
  } catch {
    return false
  }
}

async function queueDownload(task) {
  if (activeDownloads >= MAX_CONCURRENT) await new Promise(res => downloadQueue.push(res))
  activeDownloads++
  try {
    return await task()
  } finally {
    activeDownloads--
    downloadQueue.length && downloadQueue.shift()()
  }
}

async function getSkyApiUrl(videoUrl, format, timeout = 20000, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const { data } = await axios.get(`${SKY_BASE}/api/download/yt.php`, {
        params: { url: videoUrl, format },
        headers: { Authorization: `Bearer ${SKY_KEY}` },
        timeout
      })
      const url =
        data?.data?.audio ||
        data?.data?.video ||
        data?.audio ||
        data?.video ||
        data?.url ||
        data?.download
      if (url?.startsWith("http")) return url
    } catch (e) {}
    if (i < retries) await wait(500 * (i + 1))
  }
  return null
}

async function probeRemote(url, timeout = 10000) {
  try {
    const res = await axios.head(url, { timeout, maxRedirects: 5 })
    return { ok: true, size: Number(res.headers["content-length"] || 0), headers: res.headers }
  } catch {
    return { ok: false }
  }
}

async function downloadWithProgress(url, filePath, signal, start = 0) {
  const headers = start ? { Range: `bytes=${start}-` } : {}
  const res = await axios.get(url, { responseType: "stream", timeout: DOWNLOAD_TIMEOUT, headers, signal, maxRedirects: 5 })
  await streamPipe(res.data, fs.createWriteStream(filePath, { flags: start ? "a" : "w" }))
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

function ensureTask(videoUrl) {
  if (!downloadTasks[videoUrl]) downloadTasks[videoUrl] = {}
  return downloadTasks[videoUrl]
}

async function startDownload(videoUrl, key, mediaUrl, forceRestart = false, retryCount = 0) {
  const tasks = ensureTask(videoUrl)
  if (tasks[key]?.status === "downloading") return tasks[key].promise
  if (!forceRestart && tasks[key]?.status === "done") return tasks[key].file
  const ext = key.startsWith("audio") ? "mp3" : "mp4"
  const file = path.join(TMP_DIR, `${crypto.randomUUID()}_${key}.${ext}`)
  const controller = new AbortController()
  const info = { file, status: "downloading", controller, promise: null }
  info.promise = (async () => {
    try {
      if (forceRestart) safeUnlink(tasks[key]?.file)
      const probe = await probeRemote(mediaUrl)
      const expectedSize = probe.ok && probe.size
      await queueDownload(() => downloadWithProgress(mediaUrl, file, controller.signal, 0))
      if (key.startsWith("audio") && path.extname(file) !== ".mp3") info.file = await convertToMp3(file)
      else info.file = file
      if (!validCache(info.file, expectedSize)) {
        safeUnlink(info.file)
        if (retryCount < MAX_RETRIES) return await startDownload(videoUrl, key, mediaUrl, true, retryCount + 1)
        throw new Error("Archivo inválido")
      }
      if (fileSizeMB(info.file) > MAX_FILE_MB) {
        safeUnlink(info.file)
        throw new Error("Archivo demasiado grande")
      }
      info.status = "done"
      return info.file
    } catch (err) {
      info.status = "error"
      safeUnlink(info.file)
      if (retryCount < MAX_RETRIES) return await startDownload(videoUrl, key, mediaUrl, true, retryCount + 1)
      throw err
    }
  })()
  tasks[key] = info
  return info.promise
}

async function sendFileToChat(conn, chatId, filePath, title, asDocument, type, quoted) {
  if (!validCache(filePath)) return await conn.sendMessage(chatId, { text: "❌ Archivo inválido." }, { quoted })
  const buffer = fs.readFileSync(filePath)
  const msg = {}
  if (asDocument) msg.document = buffer
  else if (type === "audio") msg.audio = buffer
  else msg.video = buffer
  const mimetype = type === "audio" ? "audio/mpeg" : "video/mp4"
  const fileName = `${title}.${type === "audio" ? "mp3" : "mp4"}`
  await conn.sendMessage(chatId, { ...msg, mimetype, fileName }, { quoted })
}

function sendStatus(conn, chatId, txt, quoted) {
  return conn.sendMessage(chatId, { text: txt }, { quoted })
}

function sendError(conn, chatId, txt, quoted) {
  return conn.sendMessage(chatId, { text: `❌ ${txt}` }, { quoted })
}

async function handleDownload(conn, job, choice) {
  const map = { "👍": "audio", "❤️": "video", "📄": "audioDoc", "📁": "videoDoc" }
  const key = map[choice]
  if (!key) return
  const type = key.startsWith("audio") ? "audio" : "video"
  const isDoc = key.endsWith("Doc")
  const id = job.videoUrl
  const cached = cache[id]?.files?.[key]
  if (cached && validCache(cached)) return sendFileToChat(conn, job.chatId, cached, job.title, isDoc, type, job.commandMsg)
  const mediaUrl = await getSkyApiUrl(id, type)
  if (!mediaUrl) return sendError(conn, job.chatId, `No se obtuvo enlace de ${type}`, job.commandMsg)
  const probe = await probeRemote(mediaUrl)
  if (!probe.ok || (probe.size && probe.size / (1024 * 1024) > MAX_FILE_MB)) return sendError(conn, job.chatId, "Archivo muy grande o inaccesible", job.commandMsg)
  try {
    const f = await startDownload(id, key, mediaUrl, true, 0)
    cache[id] = cache[id] || { timestamp: Date.now(), files: {} }
    cache[id].files[key] = f
    cache[id].timestamp = Date.now()
    saveCache()
    await sendFileToChat(conn, job.chatId, f, job.title, isDoc, type, job.commandMsg)
  } catch (err) {
    await sendError(conn, job.chatId, `${err?.message || "Error al descargar"}`, job.commandMsg)
  }
}

const handler = async (msg, { conn, text, command }) => {
  const pref = global.prefixes?.[0] || "."
  if (command === "clean") {
    let deleted = 0
    let freed = 0
    Object.values(cache).forEach(data => Object.values(data.files || {}).forEach(f => {
      if (f && fs.existsSync(f)) {
        freed += fs.statSync(f).size
        safeUnlink(f)
        deleted++
      }
    }))
    fs.readdirSync(TMP_DIR).forEach(f => {
      const full = path.join(TMP_DIR, f)
      if (fs.existsSync(full)) {
        freed += fs.statSync(full).size
        safeUnlink(full)
        deleted++
      }
    })
    cache = {}
    saveCache()
    return await conn.sendMessage(msg.chat, { text: `🧹 Limpieza PRO\nEliminados: ${deleted}\nEspacio liberado: ${(freed / 1024 / 1024).toFixed(2)} MB` }, { quoted: msg })
  }
  if (!text?.trim()) return await conn.sendMessage(msg.key.remoteJid, { text: `✳️ Usa:\n${pref}play <término>\nEj: ${pref}play bad bunny diles` }, { quoted: msg })
  try {
    await conn.sendMessage(msg.key.remoteJid, { react: { text: "🕒", key: msg.key } })
  } catch {}
  let res
  try {
    res = await yts(text)
  } catch {
    return await sendError(conn, msg.key.remoteJid, "Error al buscar video.", msg)
  }
  const video = res.videos?.[0]
  if (!video) return await sendError(conn, msg.key.remoteJid, "Sin resultados.", msg)
  const { url: videoUrl, title, timestamp: duration, views, author, thumbnail } = video
  const caption = `┏━[ *Angel-𝖡᥆𝗍 𝖬𝗎𝗌𝗂𝖼 🎧* ]━┓
┃⥤🎧 *Título:* ${title}
🕑 Duración: ${duration}
👁️‍🗨️ Vistas: ${(views || 0).toLocaleString()}
🎤 Artista: ${author?.name || author || "Desconocido"}
🌐 Link: ${videoUrl}

📥 Reacciona para descargar:
☛ 1️⃣ / 👍 Audio MP3
☛ 2️⃣ / ❤️ Video MP4
☛ 3️⃣ / 📄 Audio Doc
☛ 4️⃣ / 📁 Video Doc`.trim()
  const preview = await conn.sendMessage(msg.key.remoteJid, { image: { url: thumbnail }, caption }, { quoted: msg })
  pendingManagerAdd(preview.key.id, { chatId: msg.key.remoteJid, videoUrl, title, commandMsg: msg, sender: msg.key.participant || msg.participant, downloading: false, lastPct: 0 })
  try {
    await conn.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } })
  } catch {}
  if (conn._playListener) conn.ev.off("messages.upsert", conn._playListener)
  conn._playListener = async ev => {
    for (const m of ev.messages || []) {
      const react = m.message?.reactionMessage
      if (react) {
        const { key: reactKey, text: emoji, sender } = react
        const job = pendingManagerGet(reactKey?.id)
        if (!job || !["👍", "❤️", "📄", "📁"].includes(emoji)) continue
        if ((sender || m.key.participant) !== job.sender) {
          try {
            await conn.sendMessage(job.chatId, { text: "❌ No autorizado." }, { quoted: job.commandMsg })
          } catch {}
          continue
        }
        if (job.downloading) continue
        job.downloading = true
        const msgTypeText =
          emoji === "👍" ? "Audio" :
          emoji === "❤️" ? "Vídeo" :
          emoji === "📄" ? "Audio en documento" :
          "Vídeo en documento"
        try {
          await conn.sendMessage(job.chatId, { text: `⏳ Descargando ${msgTypeText}...` }, { quoted: job.commandMsg })
        } catch {}
        try {
          await handleDownload(conn, job, emoji)
        } finally {
          job.downloading = false
        }
        continue
      }
      const ctx = m.message?.extendedTextMessage?.contextInfo
      if (!ctx?.stanzaId) continue
      const job = pendingManagerGet(ctx.stanzaId)
      if (!job) continue
      const sender = m.key.participant || m.participant
      if (sender !== job.sender) continue
      const txt =
        (m.message?.conversation || m.message?.extendedTextMessage?.text || "").trim().toLowerCase()
      let emoji = null
      if (["1", "1️⃣", "audio"].includes(txt)) emoji = "👍"
      else if (["2", "2️⃣", "video"].includes(txt)) emoji = "❤️"
      else if (["3", "3️⃣", "audiodoc", "audio doc"].includes(txt)) emoji = "📄"
      else if (["4", "4️⃣", "videodoc", "video doc"].includes(txt)) emoji = "📁"
      if (!emoji) continue
      if (job.downloading) continue
      job.downloading = true
      const msgType =
        emoji === "👍" ? "Audio" :
        emoji === "❤️" ? "Vídeo" :
        emoji === "📄" ? "Audio Documento" :
        "Vídeo Documento"
      await conn.sendMessage(job.chatId, { text: `⏳ Descargando ${msgType}...` }, { quoted: job.commandMsg })
      try {
        await handleDownload(conn, job, emoji)
      } finally {
        job.downloading = false
      }
    }
  }
  conn.ev.on("messages.upsert", conn._playListener)
}

const pending = {}
function pendingManagerAdd(id, data) {
  pending[id] = data
  setTimeout(() => delete pending[id], 1060 * 1000)
}
function pendingManagerGet(id) {
  return pending[id]
}

handler.help = ["𝖯𝗅𝖺𝗒 <𝖳𝖾𝗑𝗍𝗈>"]
handler.tags = ["𝖣𝖤𝖲𝖢𝖠𝖱𝖦𝖠𝖲"]
handler.command = ["play", "clean"]
export default handler