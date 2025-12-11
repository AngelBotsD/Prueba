// plugins/hd.js — versión ESM
import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";
import { fileURLToPath } from "url";

// Fix para __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===========================
//    Desencapsular mensajes
// ===========================
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

// ===========================
// Detectar módulo de Baileys
// ===========================
function ensureWA(wa, conn) {
  if (wa && typeof wa.downloadContentFromMessage === "function") return wa;
  if (conn?.wa && typeof conn.wa.downloadContentFromMessage === "function") return conn.wa;
  if (global.wa && typeof global.wa.downloadContentFromMessage === "function") return global.wa;
  return null;
}

// ===========================
//        HANDLER
// ===========================
const handler = async (msg, { conn, command, wa }) => {
  const chatId = msg.key.remoteJid;
  const pref = global.prefixes?.[0] || ".";

  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const quotedRaw = ctx?.quotedMessage;
  const quoted = quotedRaw ? unwrapMessage(quotedRaw) : null;

  if (!quoted?.imageMessage) {
    return conn.sendMessage(
      chatId,
      {
        text: `✳️ *Usa:*\n${pref}${command}\n📌 Responde a una *imagen* para mejorarla.`,
      },
      { quoted: msg }
    );
  }

  try {
    await conn.sendMessage(chatId, { react: { text: "🧪", key: msg.key } });
  } catch {}

  const WA = ensureWA(wa, conn);
  if (!WA) {
    try {
      await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    } catch {}
    return conn.sendMessage(
      chatId,
      { text: "❌ *Error interno:* downloader no disponible (inyecta `wa` en index.js)." },
      { quoted: msg }
    );
  }

  const tmpDir = path.join(__dirname, "tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  let tmpFile = null;

  try {
    // -------------------
    // 1) Descargar imagen
    // -------------------
    const imgNode = quoted.imageMessage;
    const stream = await WA.downloadContentFromMessage(imgNode, "image");
    const ext = (imgNode.mimetype?.split("/")[1] || "jpg").replace(/^x-/, "");
    tmpFile = path.join(tmpDir, `${Date.now()}_hd.${ext}`);

    const ws = fs.createWriteStream(tmpFile);
    for await (const chunk of stream) ws.write(chunk);
    await new Promise((r) => ws.end(r));

    // -------------------
    // 2) Subir al CDN
    // -------------------
    const form = new FormData();
    form.append("file", fs.createReadStream(tmpFile));

    const up = await axios.post("https://cdn.russellxz.click/upload.php", form, {
      headers: form.getHeaders(),
      timeout: 30000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: (s) => s >= 200 && s < 500,
    });

    const imageUrl =
      up?.data?.url ||
      up?.data?.data?.url ||
      up?.data?.result?.url ||
      null;

    if (!imageUrl) {
      throw new Error("No se obtuvo URL del CDN (upload).");
    }

    // -------------------
    // 3) Llamar API Remini
    // -------------------
    const API_KEY = "russellxz"; // tu key
    const REMINI_URL = "https://api.neoxr.eu/api/remini";

    const rem = await axios.get(
      `${REMINI_URL}?image=${encodeURIComponent(imageUrl)}&apikey=${API_KEY}`,
      {
        timeout: 45000,
        validateStatus: (s) => s >= 200 && s < 500,
      }
    );

    const enhancedUrl =
      rem?.data?.data?.url ||
      rem?.data?.result?.url ||
      rem?.data?.url ||
      null;

    if (!rem?.data?.status || !enhancedUrl) {
      throw new Error(rem?.data?.message || "La API no devolvió una imagen mejorada.");
    }

    // -------------------
    // 4) Enviar la imagen
    // -------------------
    await conn.sendMessage(
      chatId,
      {
        image: { url: enhancedUrl },
        caption: "✨ Imagen mejorada con éxito por *La Suki Bot*",
      },
      { quoted: msg }
    );

    try {
      await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch {}

  } catch (e) {
    console.error("❌ Error en .hd:", e);
    try {
      await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    } catch {}
    await conn.sendMessage(
      chatId,
      { text: `❌ *Error:* ${e?.message || "Fallo desconocido."}` },
      { quoted: msg }
    );
  } finally {
    if (tmpFile) {
      try {
        fs.unlinkSync(tmpFile);
      } catch {}
    }
  }
};

handler.command = ["de"];
handler.help = ["de"];
handler.tags = ["tools"];

export default handler;