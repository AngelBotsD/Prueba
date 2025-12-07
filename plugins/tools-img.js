import { fileURLToPath } from "url";
import fs from "fs";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const unwrap = (m) => {
  let n = m;
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
      n.ephemeralMessage?.message;
  }
  return n;
};

const handler = async (msg, { conn, wa }) => {
  try {
    const ctx = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const inner = unwrap(ctx);
    const sticker = inner?.stickerMessage;

    if (!sticker) {
      return conn.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ *Debes responder a un sticker para convertirlo en imagen.*" },
        { quoted: msg }
      );
    }

    const dcfm =
      wa?.downloadContentFromMessage ||
      (await import("@whiskeysockets/baileys")).downloadContentFromMessage;

    await conn.sendMessage(msg.key.remoteJid, { react: { text: "⏳", key: msg.key } });

    const stream = await dcfm(sticker, "sticker");
    let buffer = Buffer.alloc(0);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

    if (!buffer.length) throw new Error("Buffer vacío");

    const sharp = (await import("sharp")).default;
    const output = await sharp(buffer).jpeg().toBuffer();

    await conn.sendMessage(
      msg.key.remoteJid,
      { image: output, caption: "🖼️ *Imagen convertida del sticker*" },
      { quoted: msg }
    );

    await conn.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } });
  } catch {
    await conn.sendMessage(
      msg.key.remoteJid,
      { text: "❌ *Ocurrió un error al convertir el sticker.*" },
      { quoted: msg }
    );
  }
};

handler.command = ["toimg", "stickerimg", "img"];
handler.tags = ["tools"];
handler.help = [
  "toimg <responder a sticker> - Convierte sticker a imagen",
  "stickerimg <responder a sticker> - Convierte sticker a imagen",
];

export default handler;