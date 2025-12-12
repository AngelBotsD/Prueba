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

function findMedia(msg) {
  if (!msg) return null
  if (msg.imageMessage) return { type: 'image', media: msg.imageMessage }
  if (msg.videoMessage) return { type: 'video', media: msg.videoMessage }
  if (msg.stickerMessage) return { type: 'sticker', media: msg.stickerMessage }
  if (msg.audioMessage) return { type: 'audio', media: msg.audioMessage }

  const ctx = msg.extendedTextMessage?.contextInfo
  if (ctx?.quotedMessage) {
    const q = unwrapMessage(ctx.quotedMessage)
    return findMedia(q)
  }

  if (ctx?.thumbnail) {
    return {
      type: 'image',
      media: {
        mimetype: 'image/jpeg',
        jpegThumbnail: ctx.thumbnail
      }
    }
  }
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

  const baseMsg = unwrapMessage(msg.message)
  const detected = findMedia(baseMsg)

  if (!detected) {
    return conn.sendMessage(chatId, {
      text: `✳️ Usa:\n${pref}${command}\nResponde a una imagen, video, sticker o audio.`
    }, { quoted: msg })
  }

  await conn.sendMessage(chatId, { react: { text: '☁️', key: msg.key } })

  let rawPath = null
  let finalPath = null

  try {
    const WA = ensureWA(wa, conn)
    if (!WA) throw new Error("No se pudo acceder a Baileys.")

    const tmpDir = path.join(__dirname, 'tmp')
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

    const ext = detected.type === 'sticker'
      ? 'webp'
      : extFromMime(detected.media.mimetype, detected.type === 'image' ? 'jpg' : detected.type)

    rawPath = path.join(tmpDir, `${Date.now()}_input.${ext}`)

    if (detected.media.jpegThumbnail) {
      fs.writeFileSync(rawPath, detected.media.jpegThumbnail)
    } else {
      const stream = await WA.downloadContentFromMessage(
        detected.media,
        detected.type === 'sticker' ? 'sticker' : detected.type
      )
      const ws = fs.createWriteStream(rawPath)
      for await (const chunk of stream) ws.write(chunk)
      ws.end()
      await new Promise(r => ws.on('finish', r))
    }

    finalPath = rawPath

    const form = new FormData()
    form.append('file', fs.createReadStream(finalPath))

    const res = await axios.post('https://cdn.russellxz.click/upload.php', form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    })

    if (!res.data?.url) throw new Error('No se pudo subir.')

    await conn.sendMessage(chatId, {
      text: `➤ 𝖮𝖱𝖣𝖤𝖭 𝖤𝖩𝖤𝖢𝖴𝖳𝖠𝖣𝖠 ✅

𝖠𝖱𝖢𝖧𝖨𝖵𝖮 𝖲𝖴𝖡𝖨𝖣𝖮 𝖢𝖮𝖱𝖱𝖤𝖢𝖳𝖠𝖬𝖤𝖭𝖳𝖤. 𝖠𝖰𝖴𝖨 𝖳𝖨𝖤𝖭𝖤 𝖲𝖴 𝖴𝖱𝖫:\n${res.data.url}`
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