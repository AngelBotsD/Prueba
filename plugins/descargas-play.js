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
  return fs.statSync(filePath).size / (1024 * 1024)
}

async function queueDownload(task) {
  if (activeDownloads >= MAX_CONCURRENT) {
    await new Promise(resolve => downloadQueue.push(resolve))
  }
  activeDownloads++
  try {
    return await task()
  } finally {
    activeDownloads--
    if (downloadQueue.length) downloadQueue.shift()()
  }
}

async function downloadToFile(url, filePath, timeout = 60000) {
  const res = await axios.get(url, {
    responseType: "stream",
    timeout,
    headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 10; WhatsAppBot)" }
  })
  await streamPipe(res.data, fs.createWriteStream(filePath))
  return filePath
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

async function prepareFormats(videoUrl, id) {
  const groups = [
    [
      { key: "audio", format: "audio", ext: "mp3" },
      { key: "video", format: "video", ext: "mp4" }
    ],
    [
      { key: "audioDoc", format: "audio", ext: "mp3" },
      { key: "videoDoc", format: "video", ext: "mp4" }
    ]
  ]
  cache[id] = { timestamp: Date.now(), files: {} }
  try {
    await Promise.all(groups[0].map(async f => {
      const mediaUrl = await getSkyApiUrl(videoUrl, f.format)
      if (!mediaUrl) return
      const unique = crypto.randomUUID()
      const file = path.join(TMP_DIR, `${unique}_${f.key}.${f.ext}`)
      await queueDownload(() => downloadToFile(mediaUrl, file))
      cache[id].files[f.key] = file
    }))
  } catch {}
  for (const f of groups[1]) {
    try {
      const mediaUrl = await getSkyApiUrl(videoUrl, f.format)
      if (!mediaUrl) continue
      const unique = crypto.randomUUID()
      const file = path.join(TMP_DIR, `${unique}_${f.key}.${f.ext}`)
      await queueDownload(() => downloadToFile(mediaUrl, file))
      cache[id].files[f.key] = file
    } catch {}
  }
}

async function sendFile(conn, chatId, filePath, title, asDocument, type, quoted) {
  if (!fs.existsSync(filePath)) return
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
  const timeout = type === "audio" ? 20000 : 40000
  let filePath

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const cached = cache[job.commandMsg.key.id]?.files?.[key]
      if (cached && fs.existsSync(cached)) {
        const size = fileSizeMB(cached).toFixed(1)
        await conn.sendMessage(job.chatId, { text: `⚡ Enviando ${type} (${size} MB)` }, { quoted: job.commandMsg })
        await sendFile(conn, job.chatId, cached, job.title, isDoc, type, job.commandMsg)
        return
      }

      if (attempt === 1) {
        await conn.sendMessage(job.chatId, { text: `⏳ Reintentando descarga...` }, { quoted: job.commandMsg })
      } else {
        await conn.sendMessage(job.chatId, { text: `⏳ Descargando ${isDoc ? "documento" : type}...` }, { quoted: job.commandMsg })
      }

      const mediaUrl = await getSkyApiUrl(job.videoUrl, type, timeout, 1)
      if (!mediaUrl) throw new Error("No se obtuvo enlace válido de la API")

      const ext = type === "audio" ? "mp3" : "mp4"
      const unique = crypto.randomUUID()
      const inFile = path.join(TMP_DIR, `${unique}_in.${ext}`)
      filePath = inFile

      await queueDownload(() => downloadToFile(mediaUrl, inFile, timeout))

      if (type === "audio" && path.extname(inFile) !== ".mp3") {
        filePath = await convertToMp3(inFile)
      }

      const sizeMB = fileSizeMB(filePath)
      if (sizeMB > 99) throw new Error(`Archivo demasiado grande (${sizeMB.toFixed(2)}MB)`)

      await sendFile(conn, job.chatId, filePath, job.title, isDoc, type, job.commandMsg)
      return
    } catch (err) {
      if (attempt === 1) {
        await conn.sendMessage(job.chatId, { text: `❌ Error: ${err.message}` }, { quoted: job.commandMsg })
      }
    } finally {
      safeUnlink(filePath)
    }
  }
}

const handler = async (msg, { conn, text, command }) => {
  const pref = global.prefixes?.[0] || "."

  if (command === "clean") {
    const files = fs.readdirSync(TMP_DIR).map(f => path.join(TMP_DIR, f))
    let total = 0
    for (const f of files) {
      try {
        total += fs.statSync(f).size
        fs.unlinkSync(f)
      } catch {}
    }
    const freed = (total / (1024 * 1024)).toFixed(2)
    return conn.sendMessage(msg.chat, {
      text: `🧹 Limpieza completada\nArchivos eliminados: ${files.length}\nEspacio liberado: ${freed} MB`
    }, { quoted: msg })
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
  const viewsFmt = (views || 0).toLocaleString()
  const caption = `
𝚂𝚄𝙿𝙴𝚁 𝙿𝙻𝙰𝚈
🎵 𝚃𝚒́𝚝𝚞𝚕𝚘: ${title}
🕑 𝙳𝚞𝚛𝚊𝚌𝚒𝚘́𝚗: ${duration}
👁️‍🗨️ 𝚅𝚒𝚜𝚝𝚊𝚜: ${viewsFmt}
🎤 𝙰𝚛𝚝𝚒𝚜𝚝𝚊: ${author?.name || author || "Desconocido"}
🌐 𝙻𝚒𝚗𝚔: ${videoUrl}

📥 Opciones de descarga (usa reacciones):
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
  prepareFormats(videoUrl, preview.key.id)
  setTimeout(() => delete pending[preview.key.id], 10 * 60 * 1000)
  await conn.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } })

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
          await conn.sendMessage(job.chatId, { text: "❌ Solo quien solicitó el comando puede usar las reacciones." }, { quoted: job.commandMsg })
          continue
        }
        if (job.downloading) continue
        job.downloading = true
        try { await handleDownload(conn, job, emoji) }
        finally { job.downloading = false }
      }
    })
  }
}

handler.command = ["play","clean"]
export default handler

setInterval(() => {
  const now = Date.now()
  let totalDeleted = 0
  let countDeleted = 0

  for (const [id, data] of Object.entries(cache)) {
    if (now - data.timestamp > 20 * 24 * 60 * 60 * 1000) {
      for (const f of Object.values(data.files)) {
        if (fs.existsSync(f)) {
          try {
            totalDeleted += fs.statSync(f).size
            fs.unlinkSync(f)
            countDeleted++
          } catch {}
        }
      }
      delete cache[id]
    }
  }

  const files = fs.readdirSync(TMP_DIR).map(f => path.join(TMP_DIR, f))
  for (const f of files) {
    try {
      const stats = fs.statSync(f)
      if (now - stats.mtimeMs > 20 * 24 * 60 * 60 * 1000) {
        totalDeleted += stats.size
        fs.unlinkSync(f)
        countDeleted++
      }
    } catch {}
  }

  if (countDeleted) {
    const freed = (totalDeleted / (1024 * 1024)).toFixed(2)
    console.log(`🧹 Limpieza automática: Archivos eliminados: ${countDeleted}, Espacio liberado: ${freed} MB`)
  }
}, 60 * 60 * 1000)

const SKY_BASE = process.env.API_BASE || "https://api-sky.ultraplus.click"
const SKY_KEY = process.env.API_KEY || "mvwTRkY8iPpP"