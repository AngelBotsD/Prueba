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
    message: { locationMessage: { name: '𝖧𝗈𝗅𝖺, 𝖬𝗎𝖼𝗁𝗈 𝖦𝗎𝗌𝗍𝗈 𝖲𝗈𝗒 𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍', jpegThumbnail: thumb } },
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

  try {
    if (m.quoted && isMedia) {
      const media = await q.download()
      const tasks = []
      if (mtype === 'audioMessage') {
        tasks.push(conn.sendMessage(m.chat, { audio: media, mimetype: 'audio/mpeg', ptt: false, mentions: users }, { quoted: fkontak }))
        if (finalText) tasks.push(conn.sendMessage(m.chat, { text: finalText, mentions: users }, { quoted: fkontak }))
      } else {
        const msg = { mentions: users }
        if (mtype === 'imageMessage') msg.image = media, msg.caption = finalCaption
        if (mtype === 'videoMessage') msg.video = media, msg.caption = finalCaption, msg.mimetype = 'video/mp4'
        if (mtype === 'stickerMessage') msg.sticker = media
        tasks.push(conn.sendMessage(m.chat, msg, { quoted: fkontak }))
      }
      await Promise.all(tasks)
    } else if (m.quoted && !isMedia) {
      const msg = conn.cMod(
        m.chat,
        generateWAMessageFromContent(
          m.chat,
          { [mtype || 'extendedTextMessage']: q.message?.[mtype] || { text: finalCaption } },
          { quoted: fkontak, userJid: conn.user.id }
        ),
        finalCaption,
        conn.user.jid,
        { mentions: users }
      )
      await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    } else if (!m.quoted && isMedia) {
      const media = await m.download()
      const tasks = []
      if (mtype === 'audioMessage') {
        tasks.push(conn.sendMessage(m.chat, { audio: media, mimetype: 'audio/mpeg', ptt: false, mentions: users }, { quoted: fkontak }))
        if (finalText) tasks.push(conn.sendMessage(m.chat, { text: finalText, mentions: users }, { quoted: fkontak }))
      } else {
        const msg = { mentions: users }
        if (mtype === 'imageMessage') msg.image = media, msg.caption = finalCaption
        if (mtype === 'videoMessage') msg.video = media, msg.caption = finalCaption, msg.mimetype = 'video/mp4'
        if (mtype === 'stickerMessage') msg.sticker = media
        tasks.push(conn.sendMessage(m.chat, msg, { quoted: fkontak }))
      }
      await Promise.all(tasks)
    } else {
      await conn.sendMessage(m.chat, { text: finalCaption, mentions: users }, { quoted: fkontak })
    }
  } catch {
    await conn.sendMessage(m.chat, { text: '🔊 Notificación', mentions: users }, { quoted: fkontak })
  }
}

handler.customPrefix = /^\.?n(\s|$)/i
handler.command = new RegExp()
handler.group = true
handler.admin = true

export default handler