import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileTypeFromBuffer } from 'file-type'
import webp from 'node-webpmux'

async function addExif(webpSticker, packname, author) {
  const img = new webp.Image()
  const stickerPackId = crypto.randomBytes(32).toString('hex')
  const json = {
    'sticker-pack-id': stickerPackId,
    'sticker-pack-name': packname,
    'sticker-pack-publisher': author,
    emojis: ['✨', '❀', '💫']
  }
  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x16, 0x00, 0x00, 0x00
  ])
  const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8')
  const exif = Buffer.concat([exifAttr, jsonBuffer])
  exif.writeUIntLE(jsonBuffer.length, 14, 4)
  await img.load(webpSticker)
  img.exif = exif
  return await img.save(null)
}

let handler = async (m, { conn, text }) => {

  let q = m.quoted ? m.quoted : m
  let mime = (q.msg || q).mimetype || ''

  if (!/webp/.test(mime)) 
    return conn.sendMessage(
      m.chat,
      {
        text: `Responde a un sticker para cambiarle wm.`,
        ...global.rcanal
      },
      { quoted: m }
    )

  let defaultPack = ""
  let packname = ''
  let author = ''

  if (!text || text.trim().length === 0) {
    packname = defaultPack
    author = m.pushName || 'Usuario'
  } 
  else if (text.includes('|')) {
    let parts = text.split('|').map(v => v.trim())
    packname = parts[0] || defaultPack
    author = parts[1] || (m.pushName || '')
  } 
  else {
    packname = defaultPack
    author = text.trim()
  }

  let media = await q.download()
  let buffer = await addExif(media, packname, author)

  await conn.sendMessage(
    m.chat,
    {
      sticker: buffer,
      ...global.rcanal
    },
    { quoted: m }
  )
}

handler.help = ["wm <texto>"]
handler.tags = ["stickers"]
handler.command = ['wm', 'take', 'robarsticker']

export default handler