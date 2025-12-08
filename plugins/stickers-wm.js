import crypto from 'crypto'
import webp from 'node-webpmux'

// Generar EXIF optimizado
async function addExif(stickerBuffer, packname = '', author = '') {
  const img = new webp.Image()
  await img.load(stickerBuffer)

  const json = {
    'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
    'sticker-pack-name': packname,
    'sticker-pack-publisher': author,
    emojis: ['✨', '🌸', '💫']
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
    const q = m.quoted || m
    const mime = q.mimetype || q.msg?.mimetype || ''

    if (!/webp/.test(mime))
      return m.reply('✿ Solo puedes usar este comando respondiendo a un *sticker webp*.')

    // LIMPIEZA DEL TEXTO
    let clean = (text || '').trim()

    // Si el usuario pone solo ".wm angel" → pack = angel, autor = angel
    let packname = ''
    let author = ''

    if (clean.includes('|')) {
      // Caso normal ".wm pack | autor"
      const parts = clean.split('|').map(v => v.trim())
      packname = parts[0] || ''
      author = parts[1] || ''
    } else if (clean) {
      // Caso ".wm angel" → ambos = angel
      packname = clean
      author = clean
    }

    const stickerBuffer = await q.download()
    if (!stickerBuffer)
      return m.reply('⚠️ Hubo un error al descargar el sticker.')

    const finalSticker = await addExif(stickerBuffer, packname, author)

    await conn.sendMessage(
      m.chat,
      { sticker: finalSticker },
      { quoted: m }
    )
  } catch (e) {
    console.error(e)
    m.reply('⚠️ Error al procesar el sticker.')
  }
}

handler.help = ['wm <pack|autor>']
handler.tags = ['sticker']
handler.command = ['wm', 'take', 'robarsticker']

export default handler