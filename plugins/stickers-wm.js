import crypto from 'crypto'
import webp from 'node-webpmux'

async function addExif(stickerBuffer, packname = '') {
  const img = new webp.Image()
  await img.load(stickerBuffer)

  const json = {
    'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
    'sticker-pack-name': packname,
    emojis: ['🔥', '🗣️', '🥺']
  }

  const jsonBuf = Buffer.from(JSON.stringify(json), 'utf8')

  const exifHeader = Buffer.from([
    0x49, 0x49, 0x2A, 0x00,
    0x08, 0x00, 0x00, 0x00,
    0x01, 0x00,
    0x41, 0x57,
    0x07, 0x00,
    0x00, 0x00,
    0x00, 0x00,
    0x16, 0x00, 0x00, 0x00
  ])

  const exif = Buffer.concat([exifHeader, jsonBuf])
  exif.writeUIntLE(jsonBuf.length, 14, 4)

  img.exif = exif
  return await img.save(null)
}

let handler = async (m, { conn, text }) => {
  try {
    await conn.sendMessage(m.chat, { react: { text: '🕒', key: m.key } })

    let q = m.quoted ? m.quoted : m
    let mime = (q.msg || q).mimetype || ''

    if (!/webp/.test(mime))
      return conn.sendMessage(
        m.chat,
        {
          text: `*𝖱𝖾𝗌𝗉𝗈𝗇𝖽𝖾 𝖠 𝖴𝗇 𝖲𝗍𝗂𝖼𝗄𝖾𝗋 𝖯𝖺𝗋𝖺 𝖢𝖺𝗆𝖻𝗂𝖺𝗋𝗅𝖾 𝖤𝗅 𝖶𝗆*`,
          ...global.rcanal
        },
        { quoted: m }
      )

    let clean = (text || '').trim()
    let packname = ''

    if (clean) packname = clean
    else packname = m.pushName || 'Usuario'

    let media = await q.download()
    if (!media)
      return conn.sendMessage(
        m.chat,
        {
          text: `*𝖤𝗋𝗋𝗈𝗋 𝖺𝗅 𝖣𝖤𝗌𝖢𝖠𝖱𝖦𝖠𝗋 𝖤𝖫 𝖲𝗍𝗂𝖼𝗄𝖾𝗋*`,
          ...global.rcanal
        },
        { quoted: m }
      )

    let buffer = await addExif(media, packname)

    await conn.sendMessage(
      m.chat,
      {
        sticker: buffer,
        ...global.rcanal
      },
      { quoted: m }
    )

    await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

  } catch (e) {
    console.error(e)
    conn.sendMessage(
      m.chat,
      {
        text: `*𝖮𝖢𝖴𝖱𝖱𝖨𝖮 𝖴Ν 𝖤𝖱𝖱𝖮𝖱 𝖠𝖫 𝖯𝖱𝖮𝖢𝖤𝖲𝖠𝖱 𝖤𝖫 𝖲𝖳𝖨𝖢𝖪𝖤𝖱*`,
        ...global.rcanal
      },
      { quoted: m }
    )
  }
}

handler.help = ["𝖶𝗆 <𝖳𝖾𝗑𝗍𝗈>"]
handler.tags = ["𝖲𝖳𝖨𝖢𝖪𝖤𝖱𝖲"]
handler.command = ['wm', 'robar', 'robarsticker']

export default handler