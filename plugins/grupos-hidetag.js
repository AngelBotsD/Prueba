import { generateWAMessageFromContent, downloadContentFromMessage } from '@whiskeysockets/baileys'
import fetch from 'node-fetch'

let thumb = null

async function loadThumb() {
  if (thumb) return thumb
  try {
    const r = await fetch('https://cdn.russellxz.click/28a8569f.jpeg')
    thumb = Buffer.from(await r.arrayBuffer())
  } catch {
    thumb = null
  }
  return thumb
}

function unwrapMessage(m = {}) {
  try {
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
    return n || {}
  } catch {
    return {}
  }
}

function getMessageText(m = {}) {
  try {
    const msg = unwrapMessage(m.message)
    return (
      m.text ||
      m.msg?.caption ||
      msg?.extendedTextMessage?.text ||
      msg?.conversation ||
      ''
    )
  } catch {
    return ''
  }
}

async function downloadMedia(msgContent, type) {
  try {
    if (!msgContent || !type) return null
    const stream = await downloadContentFromMessage(msgContent, type)
    const chunks = []
    for await (const c of stream) chunks.push(c)
    return Buffer.concat(chunks)
  } catch {
    return null
  }
}

const handler = async (m, { conn, participants }) => {
  try {
    if (!m || !m.isGroup || m.key?.fromMe) return

    await loadThumb()

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

    const content = getMessageText(m)
    if (!/^\.?n(\s|$)/i.test(content?.trim?.() || '')) return

    await conn.sendMessage(m.chat, { react: { text: '🗣️', key: m.key } })

    const users = [...new Set((participants || []).map(p => conn.decodeJid(p.id)))]

    const quotedRaw = m.quoted || {}
    const q = unwrapMessage(quotedRaw)
    const mtype = q?.mtype || Object.keys(q?.message || {})[0] || ''
    const isMedia = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage'].includes(mtype)

    const userText = (content || '').trim().replace(/^\.?n(\s|$)/i, '')
    const originalCaption = (q?.msg?.caption || q?.text || '').trim?.() || ''
    const finalCaption = userText || originalCaption || '🔊 Notificación'

    if (isMedia) {
      let buffer = null
      try {
        if (q[mtype]) {
          const det = mtype.replace('Message', '').toLowerCase()
          buffer = await downloadMedia(q[mtype], det)
        }
        if (!buffer && q.download) buffer = await q.download()
      } catch {
        buffer = null
      }

      const msg = { mentions: users }

      if (mtype === 'audioMessage') {
        msg.audio = buffer
        msg.mimetype = 'audio/mpeg'
        msg.ptt = false
        await conn.sendMessage(m.chat, msg, { quoted: fkontak })
        if (userText) {
          await conn.sendMessage(
            m.chat,
            { text: userText, mentions: users },
            { quoted: fkontak }
          )
        }
        return
      }

      if (mtype === 'imageMessage') {
        msg.image = buffer
        msg.caption = finalCaption
      } else if (mtype === 'videoMessage') {
        msg.video = buffer
        msg.caption = finalCaption
        msg.mimetype = 'video/mp4'
      } else if (mtype === 'stickerMessage') {
        msg.sticker = buffer
      }

      return await conn.sendMessage(m.chat, msg, { quoted: fkontak })
    }

    if (m.quoted && !isMedia) {
      let safeMessage = null
      try {
        safeMessage = q?.message?.[mtype] || { text: finalCaption }
      } catch {
        safeMessage = { text: finalCaption }
      }

      let newMsg = null
      try {
        newMsg = conn.cMod(
          m.chat,
          generateWAMessageFromContent(
            m.chat,
            { [mtype || 'extendedTextMessage']: safeMessage },
            { quoted: fkontak, userJid: conn.user.id }
          ),
          finalCaption,
          conn.user.jid,
          { mentions: users }
        )
      } catch {
        return await conn.sendMessage(
          m.chat,
          { text: finalCaption, mentions: users },
          { quoted: fkontak }
        )
      }

      return await conn.relayMessage(
        m.chat,
        newMsg?.message,
        { messageId: newMsg?.key?.id }
      )
    }

    return await conn.sendMessage(
      m.chat,
      { text: finalCaption, mentions: users },
      { quoted: fkontak }
    )

  } catch (e) {
    return await conn.sendMessage(
      m.chat,
      { text: '🔊 Notificación', mentions: users },
      { quoted: fkontak }
    )
  }
}

handler.help = ["𝖭𝗈𝗍𝗂𝖿𝗒"]
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"]
handler.customPrefix = /^\.?n(\s|$)/i
handler.command = new RegExp()
handler.group = true
handler.admin = true

export default handler