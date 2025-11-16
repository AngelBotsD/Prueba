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
  cache[id] = cache[id] || { timestamp: Date.now(), files: {} }
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

  try {
    await Promise.all(groups[0].map(async f => {
      if (cache[id].files[f.key]) return
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
      if (cache[id].files[f.key]) continue
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
  let filePath

  const cached = cache[job.videoUrl]?.files?.[key]
  if (cached && fs.existsSync(cached)) {
    const size = fileSizeMB(cached).toFixed(1)
    await conn.sendMessage(job.chatId, { text: `⚡ Enviando ${type} (${size} MB)` }, { quoted: job.commandMsg })
    return await sendFile(conn, job.chatId, cached, job.title, isDoc, type, job.commandMsg)
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt === 0) await conn.sendMessage(job.chatId, { text: `⏳ Descargando ${type}...` }, { quoted: job.commandMsg })
      else await conn.sendMessage(job.chatId, { text: `⏳ Reintentando descarga...` }, { quoted: job.commandMsg })

      const mediaUrl = await getSkyApiUrl(job.videoUrl, type, 40000, 1)
      if (!mediaUrl) throw new Error("No se obtuvo enlace válido")

      const ext = type === "audio" ? "mp3" : "mp4"
      const unique = crypto.randomUUID()
      const inFile = path.join(TMP_DIR, `${unique}_in.${ext}`)
      filePath = inFile

      await queueDownload(() => downloadToFile(mediaUrl, inFile))

      if (type === "audio" && path.extname(inFile) !== ".mp3") {
        filePath = await convertToMp3(inFile)
      }

      const sizeMB = fileSizeMB(filePath)
      if (sizeMB > 99) throw new Error(`Archivo demasiado grande (${sizeMB.toFixed(2)}MB)`)

      cache[job.videoUrl] = cache[job.videoUrl] || { timestamp: Date.now(), files: {} }
      cache[job.videoUrl].files[key] = filePath

      await sendFile(conn, job.chatId, filePath, job.title, isDoc, type, job.commandMsg)
      return
    } catch (err) {
      if (attempt === 1) await conn.sendMessage(job.chatId, { text: `❌ Error: ${err.message}` }, { quoted: job.commandMsg })
    }
  }
}

const handler = async (msg, { conn, text, command }) => {
  const pref = global.prefixes?.[0] || "."

  if (command === "clean") {
    let deleted = 0, freed = 0
    const now = Date.now()

    Object.entries(cache).forEach(([videoUrl, data]) => {
      if (now - data.timestamp > 7 * 24 * 60 * 60 * 1000) {
        for (const f of Object.values(data.files)) {
          if (fs.existsSync(f)) {
            try {
              freed += fs.statSync(f).size
              fs.unlinkSync(f)
              deleted++
            } catch {}
          }
        }
        delete cache[videoUrl]
      }
    })

    const tempFiles = fs.readdirSync(TMP_DIR).map(f => path.join(TMP_DIR, f))
    for (const file of tempFiles) {
      try {
        if (now - fs.statSync(file).mtimeMs > 7 * 24 * 60 * 60 * 1000) {
          freed += fs.statSync(file).size
          fs.unlinkSync(file)
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
🕑 𝙳𝚞𝚛𝚊𝚌𝚒𝚘́𝚗: ${duration}
👁️‍🗨️ 𝚅𝚒𝚜𝚝𝚊𝚜: ${(views || 0).toLocaleString()}
🎤 𝙰𝚛𝚝𝚒𝚜𝚝𝚊: ${author?.name || author || "Desconocido"}
🌐 𝙻𝚒𝚗𝚔: ${videoUrl}

📥 Reacciona para descargar:
👍 Audio
❤️ Video
📄 Audio Doc
📁 Video Doc
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

  prepareFormats(videoUrl, videoUrl)
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
          await conn.sendMessage(job.chatId, { text: "❌ No autorizado." }, { quoted: job.commandMsg })
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