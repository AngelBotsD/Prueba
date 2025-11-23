import axios from "axios";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";

const API_BASE = process.env.API_BASE || "https://api-sky.ultraplus.click";
const API_KEY  = process.env.API_KEY  || "Russellxz";

const pendingYTA = Object.create(null);
const cache = Object.create(null);

function isYouTube(url = "") {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//i.test(url);
}

function fmtSec(seconds) {
  const n = Number(seconds || 0);
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  return (h ? `${h}:` : "") + `${m.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}`;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchAudio(url) {
  if (cache[url]) return cache[url];

  const endpoints = ["/api/download/yt.js", "/api/download/yt.php"];
  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    "X-API-Key": API_KEY,
    Accept: "application/json"
  };
  const params = { url, format: "audio" };

  let lastErr = null;
  for (const ep of endpoints) {
    try {
      const r = await axios.get(`${API_BASE}${ep}`, { params, headers, timeout: 30000, validateStatus: () => true });
      if (r.status >= 500 || r.status === 429 || r.status === 403) {
        lastErr = new Error(`HTTP ${r.status}${r.data?.error ? ` - ${r.data.error}` : ""}`);
        continue;
      }
      if (r.status !== 200 || !r.data || r.data.status !== "true" || !r.data.data?.audio) {
        lastErr = new Error(`API inválida: ${JSON.stringify(r.data)}`);
        continue;
      }

      const audioUrl = String(r.data.data.audio);
      const head = await axios.head(audioUrl).catch(() => null);
      const mime = head?.headers['content-type'] || 'audio/mpeg';
      const size = head?.headers['content-length'] ? Number(head.headers['content-length']) : null;

      const result = { audioUrl, meta: { ...r.data.data, mime, size } };
      cache[url] = result;
      return result;

    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error("No se pudo obtener el audio.");
}

async function transcodeToMp3Tmp(srcUrl, outName = `ytmp3-${Date.now()}.mp3`) {
  const tmpDir = path.resolve("./tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const outPath = path.join(tmpDir, outName);

  const resp = await axios.get(srcUrl, { responseType: "stream", timeout: 120000 });
  await new Promise((resolve, reject) => {
    ffmpeg(resp.data)
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .format("mp3")
      .save(outPath)
      .on("end", resolve)
      .on("error", reject);
  });

  return outPath;
}

async function sendMp3(conn, chatId, audioUrl, title, durationTxt, asDocument, quotedBase, triggerMsg, mime, size) {
  await conn.sendMessage(chatId, { react: { text: asDocument ? "📄" : "🎵", key: triggerMsg.key } });
  await conn.sendMessage(chatId, { text: `⏳ Enviando ${asDocument ? "como documento" : "audio"}…` }, { quoted: quotedBase });

  const filePath = await transcodeToMp3Tmp(audioUrl, `ytmp3-${Date.now()}.mp3`);
  const buf = fs.readFileSync(filePath);

  const caption =
`🎵 𝗬𝗧 𝗠𝗣𝟯 — 𝗟𝗶𝘀𝘁𝗼
✦ 𝗧𝗶́𝘁𝘂𝗹𝗼: ${title}
✦ 𝗗𝘂𝗿𝗮𝗰𝗶𝗼́𝗻: ${durationTxt}
✦ 𝗦𝗼𝘂𝗿𝗰𝗲: api-sky.ultraplus.click
🤖 𝙎𝙪𝙠𝙞 𝘽𝙤𝙩`;

  if (asDocument) {
    await conn.sendMessage(chatId, { document: buf, mimetype, fileName: `${title}.mp3`, caption }, { quoted: quotedBase });
  } else {
    await conn.sendMessage(chatId, { audio: buf, mimetype, fileName: `${title}.mp3`, caption }, { quoted: quotedBase });
  }

  try { fs.unlinkSync(filePath); } catch {}
  await conn.sendMessage(chatId, { react: { text: "✅", key: triggerMsg.key } });
}

const handler = async (msg, { conn, text, usedPrefix, command }) => {
  const chatId = msg.key.remoteJid;
  const pref = global.prefixes?.[0] || usedPrefix || ".";

  if (!text || !isYouTube(text)) {
    return conn.sendMessage(chatId, {
      text:
`✳️ 𝙐𝙨𝙤 𝙘𝙤𝙧𝙧𝙚𝙘𝙩𝙤:
${pref}${command} <enlace de YouTube>

📌 𝙀𝙟𝙚𝙢𝙥𝙡𝙤:
${pref}${command} https://youtu.be/dQw4w9WgXcQ`
    }, { quoted: msg });
  }

  await conn.sendMessage(chatId, { react: { text: "⏱️", key: msg.key } });

  try {
    const { audioUrl, meta } = await fetchAudio(text);
    const title = meta.title || "YouTube";
    const durationTxt = meta.duration ? fmtSec(meta.duration) : "—";
    const thumb = meta.thumbnail || "";
    const asDocument = meta.size && meta.size > 50_000_000;

    const caption =
`⚡ 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 — 𝗔𝘂𝗱𝗶𝗼

Elige cómo enviarlo:
👍 𝗔𝘂𝗱𝗶𝗼 (normal)
❤️ 𝗔𝘂𝗱𝗶𝗼 𝗰𝗼𝗺𝗼 𝗱𝗼𝗰𝘂𝗺𝗲𝗻𝘁𝗼
— 𝗼 responde: 1 = audio · 2 = documento

✦ 𝗧𝗶́𝘁𝘂𝗹𝗼: ${title}
✦ 𝗗𝘂𝗿𝗮𝗰𝗶𝗼́𝗻: ${durationTxt}
✦ 𝗦𝗼𝘂𝗿𝗰𝗲: api-sky.ultraplus.click
────────────
`;

    let preview;
    if (thumb) {
      preview = await conn.sendMessage(chatId, { image: { url: thumb }, caption }, { quoted: msg });
    } else {
      preview = await conn.sendMessage(chatId, { text: caption }, { quoted: msg });
    }

    pendingYTA[preview.key.id] = { chatId, audioUrl, title, durationTxt, quotedBase: msg };

    await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    if (!conn._ytaListener) {
      conn._ytaListener = true;
      conn.ev.on("messages.upsert", async ev => {
        for (const m of ev.messages) {
          try {
            if (m.message?.reactionMessage) {
              const { key: reactKey, text: emoji } = m.message.reactionMessage;
              const job = pendingYTA[reactKey.id];
              if (job) {
                const asDoc = emoji === "❤️";
                await sendMp3(conn, job.chatId, job.audioUrl, job.title, job.durationTxt, asDoc, job.quotedBase, m, 'audio/mpeg', null);
                delete pendingYTA[reactKey.id];
              }
            }

            const ctx = m.message?.extendedTextMessage?.contextInfo;
            const replyTo = ctx?.stanzaId;
            const textLow = (m.message?.conversation || m.message?.extendedTextMessage?.text || "").trim().toLowerCase();

            if (replyTo && pendingYTA[replyTo]) {
              const job = pendingYTA[replyTo];
              if (textLow === "1" || textLow === "2") {
                const asDoc = textLow === "2";
                await sendMp3(conn, job.chatId, job.audioUrl, job.title, job.durationTxt, asDoc, job.quotedBase, m, 'audio/mpeg', null);
                delete pendingYTA[replyTo];
              } else {
                await conn.sendMessage(job.chatId, { text: "⚠️ Responde con *1* (audio) o *2* (documento), o reacciona con 👍 / ❤️." }, { quoted: job.quotedBase });
              }
            }
          } catch (e) {
            console.error("YTMP3 listener error:", e);
          }
        }
      });
    }

  } catch (err) {
    console.error("❌ Error en ytmp3 (Sky):", err?.message || err);
    await conn.sendMessage(chatId, { text: `❌ *Error:* ${err?.message || "Fallo al procesar el audio."}` }, { quoted: msg });
    await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
  }
};

handler.command = ["ytmp3","yta"];
export default handler;