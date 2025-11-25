// tag.js — convertido a ESM + agregado soporte de vista previa (thumbnail/contact embed)
// Mantiene TODA la funcionalidad original y añade el fkontak similar al primer código

import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { downloadContentFromMessage } from "@whiskeysockets/baileys";

const DIGITS = (s = "") => String(s || "").replace(/\D/g, "");

// —— Unwrap helpers (view-once / efímeros) ——
function unwrapMessage(m) {
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
}

function getQuotedMessage(msg) {
  const root = unwrapMessage(msg?.message) || {};
  const ctx =
    root?.extendedTextMessage?.contextInfo ||
    root?.imageMessage?.contextInfo ||
    root?.videoMessage?.contextInfo ||
    root?.documentMessage?.contextInfo ||
    root?.audioMessage?.contextInfo ||
    root?.stickerMessage?.contextInfo ||
    null;
  return ctx?.quotedMessage ? unwrapMessage(ctx.quotedMessage) : null;
}

function getBodyRaw(msg) {
  const m = unwrapMessage(msg?.message) || {};
  return m?.extendedTextMessage?.text ?? m?.conversation ?? "";
}

function extractAfterAlias(body, aliases = [], prefixes = ["."]) {
  const bodyLow = body.toLowerCase();
  for (const p of prefixes) {
    for (const a of aliases) {
      const tag = (p + a).toLowerCase();
      if (bodyLow.startsWith(tag)) {
        let out = body.slice(tag.length);
        return out.startsWith(" ") ? out.slice(1) : out;
      }
    }
  }
  return "";
}

// —— PREVIEW (igual que tu primer código) ——
let thumb = null;
try {
  const res = await fetch("https://cdn.russellxz.click/28a8569f.jpeg");
  const buf = await res.arrayBuffer();
  thumb = Buffer.from(buf);
} catch {}

const fkontak = {
  key: {
    participants: "0@s.whatsapp.net",
    remoteJid: "status@broadcast",
    fromMe: false,
    id: "Angel"
  },
  message: {
    locationMessage: {
      name: "𝖧𝗈𝗅𝖺, 𝖲𝗈𝗒 𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍",
      jpegThumbnail: thumb
    }
  },
  participant: "0@s.whatsapp.net"
};

// —— HANDLER PRINCIPAL ——
const handler = async (msg, { conn, args, text, wa }) => {
  try {
    const chatId = msg.key.remoteJid;
    const isGroup = chatId.endsWith("@g.us");
    const senderId = msg.key.participant || msg.key.remoteJid;
    const senderNum = DIGITS(senderId);
    const isFromMe = !!msg.key.fromMe;

    if (!isGroup)
      return conn.sendMessage(chatId, { text: "⚠️ Este comando solo se puede usar en grupos." }, { quoted: msg });

    const rawID = conn.user?.id || "";
    const botNum = DIGITS(rawID.split(":")[0]);
    const isBot = botNum === senderNum;
    const isOwner = Array.isArray(global.owner) && global.owner.some(([id]) => id === senderNum);

    // Metadata
    let meta;
    try {
      meta = await conn.groupMetadata(chatId);
    } catch (e) {
      console.error("[tag] metadata error:", e);
      return conn.sendMessage(chatId, { text: "❌ No pude leer la metadata del grupo." }, { quoted: msg });
    }
    const participantes = Array.isArray(meta?.participants) ? meta.participants : [];

    // Admin check
    const isAdmin = participantes.some(p => {
      const ids = [p?.id, p?.jid].filter(Boolean);
      const match = ids.some(id => DIGITS(id) === senderNum);
      return match && (p?.admin === "admin" || p?.admin === "superadmin");
    });

    if (!isAdmin && !isOwner && !isBot && !isFromMe)
      return conn.sendMessage(chatId, { text: "❌ Solo admins, el owner o el bot pueden usar este comando." }, { quoted: msg });

    await conn.sendMessage(chatId, { react: { text: "🔊", key: msg.key } }).catch(() => {});

    // Menciones en orden real
    const seen = new Set();
    const mentionsOrdered = [];
    for (const p of participantes) {
      const jid = p?.id || p?.jid;
      if (!jid) continue;
      const d = DIGITS(jid);
      if (!seen.has(d)) {
        seen.add(d);
        mentionsOrdered.push(jid);
      }
    }

    // ——— Obtener mensaje citado ———
    const quoted = getQuotedMessage(msg);

    let messageToForward = null;

    if (quoted) {
      // TEXTO
      if (quoted.conversation != null)
        messageToForward = { text: quoted.conversation };
      else if (quoted.extendedTextMessage?.text != null)
        messageToForward = { text: quoted.extendedTextMessage.text };

      // MEDIA
      else if (quoted.imageMessage) {
        const stream = await downloadContentFromMessage(quoted.imageMessage, "image");
        let buffer = Buffer.alloc(0);
        for await (const c of stream) buffer = Buffer.concat([buffer, c]);
        messageToForward = {
          image: buffer,
          mimetype: quoted.imageMessage.mimetype || "image/jpeg",
          caption: quoted.imageMessage.caption ?? ""
        };

      } else if (quoted.videoMessage) {
        const stream = await downloadContentFromMessage(quoted.videoMessage, "video");
        let buffer = Buffer.alloc(0);
        for await (const c of stream) buffer = Buffer.concat([buffer, c]);
        messageToForward = {
          video: buffer,
          mimetype: quoted.videoMessage.mimetype || "video/mp4",
          gifPlayback: !!quoted.videoMessage.gifPlayback,
          caption: quoted.videoMessage.caption ?? ""
        };

      } else if (quoted.audioMessage) {
        const stream = await downloadContentFromMessage(quoted.audioMessage, "audio");
        let buffer = Buffer.alloc(0);
        for await (const c of stream) buffer = Buffer.concat([buffer, c]);
        messageToForward = {
          audio: buffer,
          mimetype: quoted.audioMessage.mimetype || "audio/mpeg",
          ptt: !!quoted.audioMessage.ptt
        };

      } else if (quoted.stickerMessage) {
        const stream = await downloadContentFromMessage(quoted.stickerMessage, "sticker");
        let buffer = Buffer.alloc(0);
        for await (const c of stream) buffer = Buffer.concat([buffer, c]);
        messageToForward = { sticker: buffer };

      } else if (quoted.documentMessage) {
        const stream = await downloadContentFromMessage(quoted.documentMessage, "document");
        let buffer = Buffer.alloc(0);
        for await (const c of stream) buffer = Buffer.concat([buffer, c]);
        messageToForward = {
          document: buffer,
          mimetype: quoted.documentMessage.mimetype || "application/octet-stream",
          fileName: quoted.documentMessage.fileName || undefined,
          caption: quoted.documentMessage.caption ?? ""
        };
      }
    }

    // SI NO HAY CITADO: usar texto exacto tras comando
    if (!messageToForward) {
      const prefixes = Array.isArray(global.prefixes) ? global.prefixes : ["."];
      const body = getBodyRaw(msg);
      const rawText = extractAfterAlias(body, ["tag", "n", "notify"], prefixes);
      if (rawText && rawText.length > 0) {
        messageToForward = { text: rawText };
      }
    }

    if (!messageToForward) {
      return conn.sendMessage(chatId, { text: "⚠️ Responde a un mensaje o escribe texto para reenviar." }, { quoted: msg });
    }

    // —— ENVÍO CON PREVIEW ——
    await conn.sendMessage(chatId, { ...messageToForward, mentions: mentionsOrdered }, { quoted: fkontak });

  } catch (err) {
    console.error("❌ Error en tag.js:", err);
    await conn.sendMessage(msg.key.remoteJid, { text: "❌ Hubo un error ejecutando el comando." }, { quoted: msg });
  }
};

handler.command = ["tag", "n", "notify"];
export default handler;
