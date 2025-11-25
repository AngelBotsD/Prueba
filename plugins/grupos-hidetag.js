import { generateWAMessageFromContent, downloadContentFromMessage } from '@whiskeysockets/baileys'
import fetch from 'node-fetch'

let thumb = null
async function loadThumb() {
  if (thumb) return thumb
  try {
    const res = await fetch('https://cdn.russellxz.click/28a8569f.jpeg')
    thumb = Buffer.from(await res.arrayBuffer())
  } catch {
    thumb = null
  }
  return thumb
}

function unwrapMessage(m = {}) {
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

async function downloadMedia(msg, type) {
  try {
    const stream = await downloadContentFromMessage(msg, type)
    const chunks = []
    for await (const c of stream) chunks.push(c)
    return Buffer.concat(chunks)
  } catch {
    return null
  }
}

const handler = async (m, { conn, participants }) => {
  if (!m.isGroup || m.key.fromMe) return

  await loadThumb()

  const fkontak = {
    key: {
      fromMe: false,
      participant: '0@s.whatsapp.net',
      id: 'notify'
    },
    message: {
      locationMessage: {
        name: 'Hola, Soy Angel Bot',
        jpegThumbnail: thumb
      }
    }
  }

  const text = (m.text || '').trim()
  if (!/^\.?n(\s|$)/i.test(text)) return

  await conn.sendMessage(m.chat, { react: { text: '🗣️', key: m.key } })

  const users = [...new Set(participants.map(p => conn.decodeJid(p.id)))]
  const userText = text.replace(/^\.?n(\s|$)/i, '').trim()

  const quoted = m.quoted ? unwrapMessage(m.quoted.message || m.quoted) : null
  const q = quoted || {}

  const isImage = !!q.imageMessage
  const isVideo = !!q.videoMessage

  if (!isImage && !isVideo) {
    return await conn.sendMessage(
      m.chat,
      { text: userText || '🔊 Notificación', mentions: users },
      { quoted: fkontak }
    )
  }

  const mediaType = isImage ? 'image' : 'video'
  const baileyType = isImage ? 'imageMessage' : 'videoMessage'

  let buffer = await downloadMedia(q[baileyType], mediaType)
  if (!buffer && m.quoted?.download) buffer = await m.quoted.download()

  const msg = {
    mentions: users
  }

  if (isImage) {
    msg.image = buffer
    msg.caption = userText || ''
  } else if (isVideo) {
    msg.video = buffer
    msg.caption = userText || ''
    msg.mimetype = 'video/mp4'
  }

  return await conn.sendMessage(m.chat, msg, { quoted: fkontak })
}

handler.help = ["notify"]
handler.tags = ["grupos"]
handler.customPrefix = /^\.?n(\s|$)/i
handler.command = new RegExp()
handler.group = true
handler.admin = true

export default handler