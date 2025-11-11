import { generateWAMessageFromContent } from '@whiskeysockets/baileys'
import fetch from 'node-fetch'

let thumb
fetch('https://i.postimg.cc/rFfVL8Ps/image.jpg')
  .then(r => r.arrayBuffer())
  .then(buf => thumb = Buffer.from(buf))
  .catch(() => thumb = null)

const handler = async (m, { conn, participants }) => {
  if (!m.isGroup || m.key.fromMe) return

  const fkontak = {
    key: { participants: '0@s.whatsapp.net', remoteJid: 'status@broadcast', fromMe: false, id: 'Halo' },
    message: { locationMessage: { name: '𝖧𝗈𝗅𝖺, 𝖲𝗈𝗒 𝖡𝖺𝗄𝗂-𝖡𝗈𝗍', jpegThumbnail: thumb } },
    participant: '0@s.whatsapp.net'
  }

  const content = m.text || m.msg?.caption || ''
  if (!/^\.?n(\s|$)/i.test(content.trim())) return

  await conn.sendMessage(m.chat, { react: { text: '🔊', key: m.key } })

  const users = participants.map(u => conn.decodeJid(u.id))
  const userText = content.trim().replace(/^\.?n(\s|$)/i, '')
  const finalText = userText || ''
  const q = m.quoted ? m.quoted : m
  const mtype = q.mtype || ''
  const isMedia = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage'].includes(mtype)
  const originalCaption = (q.msg?.caption || q.text || '').trim()
  const finalCaption = finalText || originalCaption || '🔊 Notificación'
  const hasLink = /https?:\/\/\S+/.test(finalCaption)

  try {
    // 🔹 Si es media (imagen, video, audio, sticker)
    if (m.quoted && isMedia) {
      const media = await q.download()
      const tasks = []
      if (mtype === 'audioMessage') {
        tasks.push(conn.sendMessage(m.chat, { audio: media, mimetype: 'audio/mpeg', ptt: false, mentions: users }, { quoted: fkontak }))
        if (finalText) tasks.push(conn.sendMessage(m.chat, { text: finalText, mentions: users, detectLink: true }, { quoted: fkontak }))
      } else {
        const msg = { mentions: users, detectLink: true }
        if (mtype === 'imageMessage') msg.image = media, msg.caption = finalCaption
        if (mtype === 'videoMessage') msg.video = media, msg.caption = finalCaption, msg.mimetype = 'video/mp4'
        if (mtype === 'stickerMessage') msg.sticker = media
        tasks.push(conn.sendMessage(m.chat, msg, { quoted: fkontak }))
      }
      await Promise.all(tasks)
      return
    }

    // 🔹 Si responde a texto o envía texto con link
    if (hasLink) {
      // ⚠️ Si hay un link, no usar fkontak (para permitir vista previa)
      await conn.sendMessage(m.chat, {
        text: finalCaption,
        mentions: users,
        detectLink: true
      })
      return
    }

    // 🔹 Si no hay link → usar fkontak normalmente
    await conn.sendMessage(m.chat, { text: finalCaption, mentions: users, detectLink: true }, { quoted: fkontak })
  } catch (e) {
    console.error(e)
    await conn.sendMessage(m.chat, { text: '🔊 Notificación', mentions: users, detectLink: true }, { quoted: fkontak })
  }
}

handler.customPrefix = /^\.?n(\s|$)/i
handler.command = new RegExp()
handler.group = true
handler.admin = true

export default handler