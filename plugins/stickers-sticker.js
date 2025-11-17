import fs from 'fs';
import path from 'path';
import Crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import webp from 'node-webpmux';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

const tempFolder = path.join(process.cwd(), 'tmp/');
if (!fs.existsSync(tempFolder)) fs.mkdirSync(tempFolder, { recursive: true });

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const pref = global.prefixes?.[0] || ".";

  try {
    let quoted = null;
    let mediaType = null;

    // Media directa
    if (msg.message?.imageMessage) {
      quoted = msg.message;
      mediaType = "image";
    } else if (msg.message?.videoMessage) {
      quoted = msg.message;
      mediaType = "video";
    }

    // Media citada
    if (!quoted) {
      const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (q?.imageMessage) {
        quoted = q;
        mediaType = "image";
      } else if (q?.videoMessage) {
        quoted = q;
        mediaType = "video";
      }
    }

    if (!quoted || !mediaType) {
      return await conn.sendMessage(
        chatId,
        { text: `\`\`\`𝖱𝖾𝗌𝗉𝗈𝗇𝖽𝖾 𝖠 𝖴𝗇𝖺 𝖨𝗆𝖺𝗀𝖾𝗇 𝖮 𝖵𝗂𝖽𝖾𝗈 𝖯𝖺𝗋𝖺 𝖢𝗋𝖾𝖺𝗋 𝖤𝗅 𝖲𝗍𝗂𝖼𝗄𝖾𝗋`\`\`\`, ...global.rcanal },
        { quoted: msg }
      );
    }

    await conn.sendMessage(chatId, { react: { text: '🛠️', key: msg.key } });

    // Descargar media
    const mediaStream = await downloadContentFromMessage(
      quoted[`${mediaType}Message`],
      mediaType
    );
    let buffer = Buffer.alloc(0);
    for await (const chunk of mediaStream) buffer = Buffer.concat([buffer, chunk]);

    const metadata = { packname: ``, author: `` };

    const sticker = mediaType === 'image'
      ? await writeExifImg(buffer, metadata)
      : await writeExifVid(buffer, metadata);

    // === AQUI SE AGREGA global.rcanal ===
    await conn.sendMessage(
      chatId,
      { sticker: { url: sticker }, ...global.rcanal },
      { quoted: msg }
    );

    await conn.sendMessage(chatId, { react: { text: '✅', key: msg.key } });

  } catch (err) {
    console.error('❌ Error en sticker s:', err);

    await conn.sendMessage(
      chatId,
      { text: '❌ *Hubo un error al procesar el sticker.*', ...global.rcanal },
      { quoted: msg }
    );

    await conn.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
  }
};

handler.customPrefix = /^(\.s|s)$/i
handler.command = new RegExp
export default handler;


// === FUNCIONES AUXILIARES ===
function randomFileName(ext) {
  return `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.${ext}`;
}

async function imageToWebp(media) {
  const tmpIn = path.join(tempFolder, randomFileName('jpg'));
  const tmpOut = path.join(tempFolder, randomFileName('webp'));
  fs.writeFileSync(tmpIn, media);

  await new Promise((resolve, reject) => {
    ffmpeg(tmpIn)
      .on('error', reject)
      .on('end', resolve)
      .addOutputOptions([
        "-vcodec", "libwebp",
        "-vf", "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse"
      ])
      .toFormat('webp')
      .save(tmpOut);
  });

  const buff = fs.readFileSync(tmpOut);
  fs.unlinkSync(tmpIn);
  fs.unlinkSync(tmpOut);
  return buff;
}

async function videoToWebp(media) {
  const tmpIn = path.join(tempFolder, randomFileName('mp4'));
  const tmpOut = path.join(tempFolder, randomFileName('webp'));
  fs.writeFileSync(tmpIn, media);

  await new Promise((resolve, reject) => {
    ffmpeg(tmpIn)
      .on('error', reject)
      .on('end', resolve)
      .addOutputOptions([
        "-vcodec", "libwebp",
        "-vf", "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse",
        "-loop", "0",
        "-ss", "00:00:00",
        "-t", "00:00:05",
        "-preset", "default",
        "-an",
        "-vsync", "0"
      ])
      .toFormat('webp')
      .save(tmpOut);
  });

  const buff = fs.readFileSync(tmpOut);
  fs.unlinkSync(tmpIn);
  fs.unlinkSync(tmpOut);
  return buff;
}

async function writeExifImg(media, metadata) {
  const wMedia = await imageToWebp(media);
  return await addExif(wMedia, metadata);
}

async function writeExifVid(media, metadata) {
  const wMedia = await videoToWebp(media);
  return await addExif(wMedia, metadata);
}

async function addExif(webpBuffer, metadata) {
  const tmpIn = path.join(tempFolder, randomFileName('webp'));
  const tmpOut = path.join(tempFolder, randomFileName('webp'));
  fs.writeFileSync(tmpIn, webpBuffer);

  const json = {
    "sticker-pack-id": "azura-ultra&cortana",
    "sticker-pack-name": metadata.packname,
    "sticker-pack-publisher": metadata.author,
    "emojis": metadata.categories || [""]
  };

  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2A, 0x00,
    0x08, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x41, 0x57,
    0x07, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x16, 0x00,
    0x00, 0x00
  ]);

  const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
  const exif = Buffer.concat([exifAttr, jsonBuff]);
  exif.writeUIntLE(jsonBuff.length, 14, 4);

  const img = new webp.Image();
  await img.load(tmpIn);
  img.exif = exif;
  await img.save(tmpOut);
  fs.unlinkSync(tmpIn);
  return tmpOut;
}