import axios from "axios"
import yts from "yt-search"
import fs from "fs"
import path from "path"
import ffmpeg from "fluent-ffmpeg"
import { promisify } from "util"
import { pipeline } from "stream"
const streamPipe = promisify(pipeline)

const API_BASE = process.env.API_BASE || "https://api-sky.ultraplus.click"
const API_KEY = process.env.API_KEY || "Russellxz"

const pending = {}

async function downloadToFile(url, filePath) {
  const res = await axios.get(url, { responseType: "stream" })
  await streamPipe(res.data, fs.createWriteStream(filePath))
  return filePath
}

function fileSizeMB(filePath) {
  const b = fs.statSync(filePath).size
  return b / (1024 * 1024)
}

async function callMyApi(url, format) {
  const r = await axios.get(`${API_BASE}/api/download/yt.php`, {
    params: { url, format },
    headers: { Authorization: `Bearer ${API_KEY}` },
    timeout: 60000
  })
  if (!r.data || r.data.status !== "true" || !r.data.data) {
    throw new Error("API inválida")
  }
  return r.data.data
}

const handler = async (msg, { conn, text }) => {
  const pref = global.prefixes?.[0] || "."

  if (!text || !text.trim()) {
    return conn.sendMessage(
      msg.key.remoteJid,
      { text: `Usa:\n${pref}play <término>` },
      { quoted: msg }
    )
  }

  await conn.sendMessage(msg.key.remoteJid, {
    react: { text: "⏳", key: msg.key }
  })

  const res = await yts(text)
  const video = res.videos?.[0]
  if (!video) {
    return conn.sendMessage(
      msg.key.remoteJid,
      { text: "Sin resultados." },
      { quoted: msg }
    )
  }

  const { url: videoUrl, title, timestamp: duration, views, author, thumbnail } = video
  const viewsFmt = (views || 0).toLocaleString()

  const caption = `
Título: ${title}
Duración: ${duration}
Vistas: ${viewsFmt}
Autor: ${author?.name || "Desconocido"}
Link: ${videoUrl}

Opciones:
👍 Audio MP3   (1 / audio)
❤️ Video MP4   (2 / video)
📄 Audio Doc   (4 / audiodoc)
📁 Video Doc   (3 / videodoc)
`.trim()

  const preview = await conn.sendMessage(
    msg.key.remoteJid,
    { image: { url: thumbnail }, caption },
    { quoted: msg }
  )

  pending[preview.key.id] = {
    chatId: msg.key.remoteJid,
    videoUrl,
    title,
    commandMsg: msg,
    done: { audio: false, video: false, audioDoc: false, videoDoc: false }
  }

  await conn.sendMessage(msg.key.remoteJid, {
    react: { text: "✅", key: msg.key }
  })

  if (!conn._playListener) {
    conn._playListener = true
    conn.ev.on("messages.upsert", async ev => {
      for (const m of ev.messages) {
        if (m.message?.reactionMessage) {
          const { key: reactKey, text: emoji } = m.message.reactionMessage
          const job = pending[reactKey.id]
          if (job) {
            await handleDownload(conn, job, emoji, job.commandMsg)
          }
        }

        try {
          const context = m.message?.extendedTextMessage?.contextInfo
          const citado = context?.stanzaId
          const texto = (
            m.message?.conversation?.toLowerCase() ||
            m.message?.extendedTextMessage?.text?.toLowerCase() ||
            ""
          ).trim()
          const job = pending[citado]
          const chatId = m.key.remoteJid

          if (citado && job) {
            if (["1", "audio", "4", "audiodoc"].includes(texto)) {
              const docMode = ["4", "audiodoc"].includes(texto)
              await conn.sendMessage(chatId, { text: `Descargando audio...` }, { quoted: m })
              await downloadAudio(conn, job, docMode, m)
            } else if (["2", "video", "3", "videodoc"].includes(texto)) {
              const docMode = ["3", "videodoc"].includes(texto)
              await conn.sendMessage(chatId, { text: `Descargando video...` }, { quoted: m })
              await downloadVideo(conn, job, docMode, m)
            } else {
              await conn.sendMessage(chatId, {
                text: `Opciones válidas:\n1/audio, 4/audiodoc → audio\n2/video, 3/videodoc → video`
              }, { quoted: m })
            }

            if (!job._timer) {
              job._timer = setTimeout(() => delete pending[citado], 5 * 60 * 1000)
            }
          }
        } catch {}
      }
    })
  }
}

async function handleDownload(conn, job, choice) {
  const mapping = {
    "👍": "audio",
    "❤️": "video",
    "📄": "audioDoc",
    "📁": "videoDoc"
  }
  const key = mapping[choice]
  if (key) {
    const isDoc = key.endsWith("Doc")
    await conn.sendMessage(job.chatId, { text: `Descargando...` }, { quoted: job.commandMsg })
    if (key.startsWith("audio")) await downloadAudio(conn, job, isDoc, job.commandMsg)
    else await downloadVideo(conn, job, isDoc, job.commandMsg)
  }
}

async function downloadAudio(conn, job, asDocument, quoted) {
  const { chatId, videoUrl, title } = job
  const data = await callMyApi(videoUrl, "audio")
  const mediaUrl = data.audio || data.video

  const tmp = path.join(process.cwd(), "tmp")
  if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true })

  const urlPath = new URL(mediaUrl).pathname || ""
  const ext = (urlPath.split(".").pop() || "").toLowerCase()
  const isMp3 = ext === "mp3"

  const inFile = path.join(tmp, `${Date.now()}_in.${ext || "bin"}`)
  await downloadToFile(mediaUrl, inFile)

  let outFile = inFile
  if (!isMp3) {
    const tryOut = path.join(tmp, `${Date.now()}_out.mp3`)
    try {
      await new Promise((resolve, reject) =>
        ffmpeg(inFile)
          .audioCodec("libmp3lame")
          .audioBitrate("128k")
          .format("mp3")
          .save(tryOut)
          .on("end", resolve)
          .on("error", reject)
      )
      outFile = tryOut
      try { fs.unlinkSync(inFile) } catch {}
    } catch {
      outFile = inFile
    }
  }

  const sizeMB = fileSizeMB(outFile)
  if (sizeMB > 99) {
    try { fs.unlinkSync(outFile) } catch {}
    await conn.sendMessage(chatId, { text: `Archivo demasiado pesado (${sizeMB.toFixed(2)}MB)` }, { quoted })
    return
  }

  const buffer = fs.readFileSync(outFile)
  await conn.sendMessage(chatId, {
    [asDocument ? "document" : "audio"]: buffer,
    mimetype: "audio/mpeg",
    fileName: `${title}.mp3`
  }, { quoted })

  try { fs.unlinkSync(outFile) } catch {}
}

async function downloadVideo(conn, job, asDocument, quoted) {
  const { chatId, videoUrl, title } = job
  const data = await callMyApi(videoUrl, "video")
  const mediaUrl = data.video || data.audio

  const tmp = path.join(process.cwd(), "tmp")
  if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true })

  const file = path.join(tmp, `${Date.now()}_vid.mp4`)
  await downloadToFile(mediaUrl, file)

  const sizeMB = fileSizeMB(file)
  if (sizeMB > 99) {
    try { fs.unlinkSync(file) } catch {}
    await conn.sendMessage(chatId, { text: `Archivo demasiado pesado (${sizeMB.toFixed(2)}MB)` }, { quoted })
    return
  }

  await conn.sendMessage(chatId, {
    [asDocument ? "document" : "video"]: fs.readFileSync(file),
    mimetype: "video/mp4",
    fileName: `${title}.mp4`
  }, { quoted })

  try { fs.unlinkSync(file) } catch {}
}

handler.command = ["play"]

export default handler