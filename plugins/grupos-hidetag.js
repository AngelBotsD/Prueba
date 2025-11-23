import { generateWAMessageFromContent } from '@whiskeysockets/baileys'
import fetch from 'node-fetch'

let thumb = null
fetch('https://cdn.russellxz.click/28a8569f.jpeg')
  .then(r => r.arrayBuffer())
  .then(buf => thumb = Buffer.from(buf))
  .catch(() => null)

const handler = async (m, { conn, participants }) => {
  if (!m.isGroup || m.key.fromMe) return

  const fkontak = {
    key: {
      participants: '0@s.whatsapp.net',
      remoteJid: 'status@broadcast',
      fromMe: false,
      id: 'Angel'
    },
    message: {
      locationMessage: {
        name: '𝖧𝗈𝗅𝖺, 𝖲𝗈𝗒 𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍',
        jpegThumbnail: thumb
      }
    },
    participant: '0@s.whatsapp.net'
  }

  const content = m.text || m.msg?.caption || ''
  if (!/^\.?n(\s|$)/i.test(content.trim())) return

  await conn.sendMessage(m.chat, { react: { text: '🗣️', key: m.key } })

  const users = participants.map(u => conn.decodeJid(u.id))
  const q = m.quoted ? m.quoted : m
  const mtype = q.mtype || Object.keys(q.message || {})[0] || ''
  const isMedia = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage'].includes(mtype)

  const userText = content.trim().replace(/^\.?n(\s|$)/i, '')
  const originalCaption = (q.msg?.caption || q.text || '').trim()
  const finalCaption = userText || originalCaption || '🔊 Notificación'

  try {
    if (isMedia) {
      const media = await q.download()
      const msg = { mentions: users }

      if (mtype === 'audioMessage') {
        msg.audio = media
        msg.mimetype = 'audio/mpeg'
        msg.ptt = false

        await conn.sendMessage(m.chat, msg, { quoted: fkontak })
        if (userText) {
          await conn.sendMessage(m.chat, { text: userText, mentions: users }, { quoted: fkontak })
        }
        return
      }

      if (mtype === 'imageMessage') {
        msg.image = media
        msg.caption = finalCaption
      } else if (mtype === 'videoMessage') {
        msg.video = media
        msg.caption = finalCaption
        msg.mimetype = 'video/mp4'
      } else if (mtype === 'stickerMessage') {
        msg.sticker = media
      }

      return await conn.sendMessage(m.chat, msg, { quoted: fkontak })
    }

    if (m.quoted && !isMedia) {
      const newMsg = conn.cMod(
        m.chat,
        generateWAMessageFromContent(
          m.chat,
          {
            [mtype || 'extendedTextMessage']:
              q.message?.[mtype] || { text: finalCaption }
          },
          { quoted: fkontak, userJid: conn.user.id }
        ),
        finalCaption,
        conn.user.jid,
        { mentions: users }
      )

      return await conn.relayMessage(m.chat, newMsg.message, { messageId: newMsg.key.id })
    }

    return await conn.sendMessage(
      m.chat,
      { text: finalCaption, mentions: users },
      { quoted: fkontak }
    )

  } catch (err) {
    return await conn.sendMessage(
      m.chat,
      { text: '🔊 Notificación', mentions: users },
      { quoted: fkontak }
    )
  }
}

handler.help = ["𝖭𝗈𝗍𝗂𝖿𝗒"];
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"];
handler.customPrefix = /^\.?n(\s|$)/i
handler.command = new RegExp()
handler.group = true
handler.admin = true

export default handler