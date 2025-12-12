import fs from 'fs'
import path from 'path'
import axios from 'axios'
import FormData from 'form-data'
import ffmpeg from 'fluent-ffmpeg'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function unwrapMessage(m) {
  let n = m
  while (
    n?.viewOnceMessage?.message ||
    n?.viewOnceMessageV2?.message ||
    n?.viewOnceMessageV2Extension?.message ||
    n?.ephemeralMessage?.message
  ) {
    n =
      n.viewOnceMessage?.message ||
      n.viewOnceMessageV2?.message ||
      n.viewOnceMessageV2Extension?.message ||
      n.ephemeralMessage?.message
  }
  return n
}

function ensureWA(wa, conn) {
  if (wa?.downloadContentFromMessage) return wa
  if (conn?.wa?.downloadContentFromMessage) return conn.wa
  if (global.wa?.downloadContentFromMessage) return global.wa
  return null
}

function extFromMime(mime, fallback = 'bin') {
  if (!mime) return fallback
  const m = mime.toLowerCase()
  if (m.includes('image/')) {
    if (m.includes('jpeg')) return 'jpg'
    if (m.includes('png')) return 'png'
    if (m.includes('webp')) return 'webp'
    return 'jpg'
  }
  if (m.includes('video/')) {
    if (m.includes('mp4')) return 'mp4'
    if (m.includes('3gpp')) return '3gp'
    if (m.includes('webm')) return 'webm'
    return 'mp4'
  }
  if (m.includes('audio/')) {
    if (m.includes('mpeg') || m.includes('mp3')) return 'mp3'
    if (m.includes('ogg')) return 'ogg'
    if (m.includes('opus')) return 'opus'
    if (m.includes('aac')) return 'aac'
    if (m.includes('wav')) return 'wav'
    if (m.includes('x-m4a') || m.includes('m4a')) return 'm4a'
    if (m.includes('amr')) return 'amr'
    return 'mp3'
  }
  if (m.includes('application/pdf')) return 'pdf'
  return fallback
}

const handler = async (msg, { conn, command, wa }) => {
  const chatId = msg.key.remoteJid
  const pref = global.prefixes?.[0] || "."

  const ctx = msg.message?.extendedTextMessage?.contextInfo
  const rawQuoted = ctx?.quotedMessage
  const quoted = rawQuoted ? unwrapMessage(rawQuoted) : null

  if (!quoted) {
    return conn.sendMessage(chatId, {
      text: `✳️ Usa:\n${pref}${command}\nResponde a una imagen, video, sticker o audio.`
    }, { quoted: msg })
  }

  await conn.sendMessage(chatId, { react: { text: '☁️', key: msg.key } })

  let tmpMade = false
  let rawPath = null
  let finalPath = null

  try {
    let typeDetected = null
    let mediaMessage = null

    if (quoted.imageMessage) {
      typeDetected = 'image'
      mediaMessage = quoted.imageMessage
    } else if (quoted.videoMessage) {
      typeDetected = 'video'
      mediaMessage = quoted.videoMessage
    } else if (quoted.stickerMessage) {
      typeDetected = 'sticker'
      mediaMessage = quoted.stickerMessage
    } else if (quoted.audioMessage) {
      typeDetected = 'audio'
      mediaMessage = quoted.audioMessage
    } else {
      throw new Error("Solo se permiten imágenes, videos, stickers o audios.")
    }

    const WA = ensureWA(wa, conn)
    if (!WA) throw new Error("No se pudo acceder a Baileys.")

    const tmpDir = path.join(__dirname, 'tmp')
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
    tmpMade = true

    const rawExt = typeDetected === 'sticker'
      ? 'webp'
      : extFromMime(
          mediaMessage.mimetype,
          typeDetected === 'image'
            ? 'jpg'
            : typeDetected === 'video'
            ? 'mp4'
            : typeDetected === 'audio'
            ? 'mp3'
            : 'bin'
        )

    rawPath = path.join(tmpDir, `${Date.now()}_input.${rawExt}`)
    const stream = await WA.downloadContentFromMessage(
      mediaMessage,
      typeDetected === 'sticker' ? 'sticker' : typeDetected
    )
    const ws = fs.createWriteStream(rawPath)
    for await (const chunk of stream) ws.write(chunk)
    ws.end()
    await new Promise(r => ws.on('finish', r))

    const stats = fs.statSync(rawPath)
    if (stats.size > 200 * 1024 * 1024) {
      throw new Error('El archivo excede 200MB.')
    }

    finalPath = rawPath

    if (typeDetected === 'audio' && ['ogg', 'm4a', 'opus', 'aac', 'wav', 'amr'].includes(rawExt)) {
      finalPath = path.join(tmpDir, `${Date.now()}_converted.mp3`)
      await new Promise((resolve, reject) => {
        ffmpeg(rawPath)
          .audioCodec('libmp3lame')
          .toFormat('mp3')
          .on('end', resolve)
          .on('error', reject)
          .save(finalPath)
      })
      try { fs.unlinkSync(rawPath) } catch {}
    }

    const form = new FormData()
    form.append('file', fs.createReadStream(finalPath))

    const res = await axios.post('https://cdn.russellxz.click/upload.php', form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    })

    if (!res.data?.url) throw new Error('No se pudo subir el archivo.')

    await conn.sendMessage(chatId, {
      text: `✅ Archivo subido:\n${res.data.url}`
    }, { quoted: msg })

    await conn.sendMessage(chatId, { react: { text: '✅', key: msg.key } })

  } catch (err) {
    await conn.sendMessage(chatId, {
      text: `❌ Error: ${err.message || err}`
    }, { quoted: msg })
    await conn.sendMessage(chatId, { react: { text: '❌', key: msg.key } })
  } finally {
    try { if (finalPath && fs.existsSync(finalPath)) fs.unlinkSync(finalPath) } catch {}
    try { if (rawPath && fs.existsSync(rawPath)) fs.unlinkSync(rawPath) } catch {}
  }
}

handler.command = ['tourl']
handler.help = ['tourl']
handler.tags = ['herramientas']

export default handler