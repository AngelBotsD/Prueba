import crypto from 'crypto'
import webp from 'node-webpmux'

// Crear EXIF solo con packname
async function addExif(stickerBuffer, packname = '') {
  const img = new webp.Image()
  await img.load(stickerBuffer)

  const json = {
    'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
    'sticker-pack-name': packname,
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
      return m.reply('✿ Responde a un *sticker webp* para editar su watermark.')

    // Limpieza del texto
    let clean = (text || '').trim()

    let packname = ''

    if (clean) {
      // Si la persona envía ".wm algo" → packname = lo escrito
      packname = clean
    } else {
      // Si la persona envía solo ".wm" → packname = nombre del usuario
      packname = m.pushName || 'Usuario'
    }

    const stickerBuffer = await q.download()
    if (!stickerBuffer)
      return m.reply('⚠️ No pude descargar el sticker.')

    const finalSticker = await addExif(stickerBuffer, packname)

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

handler.help = ['wm <pack>']
handler.tags = ['sticker']
handler.command = ['wm', 'take', 'robarsticker']

export default handler