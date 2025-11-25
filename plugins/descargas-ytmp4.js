import axios from "axios";

const API_BASE = process.env.API_BASE || "https://api-sky.ultraplus.click";
const API_KEY  = process.env.API_KEY  || "Russellxz";

const AXIOS_TIMEOUT = 0;
axios.defaults.timeout = AXIOS_TIMEOUT;
axios.defaults.maxBodyLength = Infinity;
axios.defaults.maxContentLength = Infinity;

const pendingYTV = Object.create(null);
const cache = Object.create(null);

function isYouTube(url) {
  return /^https?:\/\//i.test(url) && /(youtube\.com|youtu\.be|music\.youtube\.com)/i.test(url);
}

function fmtDur(seconds) {
  const n = Number(seconds || 0);
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  return (h ? `${h}:` : "") + `${m.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}`;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchVideo(url) {
  if (cache[url]) return cache[url];

  const endpoints = ["/api/download/yt.js", "/api/download/yt.php"];
  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    "X-API-Key": API_KEY,
    Accept: "application/json"
  };
  const params = { url, format: "video" };

  const requests = endpoints.map(ep => axios.get(`${API_BASE}${ep}`, { params, headers, timeout: AXIOS_TIMEOUT, validateStatus: () => true }));

  let lastErr = null;
  for (const req of requests) {
    try {
      const r = await req;
      if (r.status >= 500 || r.status === 429 || r.status === 403) {
        lastErr = new Error(`HTTP ${r.status}${r.data?.error ? ` - ${r.data.error}` : ""}`);
        continue;
      }
      if (r.status !== 200) {
        lastErr = new Error(`HTTP ${r.status}`);
        continue;
      }
      const d = r.data?.data;
      if (!r.data || r.data.status !== "true" || !d) {
        lastErr = new Error(`API inválida: ${JSON.stringify(r.data)}`);
        continue;
      }
      const mediaUrl = d.video || d.audio;
      if (!mediaUrl) {
        lastErr = new Error("El API no devolvió video.");
        continue;
      }

      const head = await axios.head(mediaUrl).catch(() => null);
      const mime = head?.headers['content-type'] || 'video/mp4';
      const size = head?.headers['content-length'] ? Number(head.headers['content-length']) : null;

      const result = { mediaUrl, meta: { ...d, mime, size } };
      cache[url] = result;
      return result;

    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error("No se pudo obtener el video.");
}

async function sendVideo(conn, chatId, mediaUrl, title, asDocument, baseMsg, mime, size, triggerMsg) {
  await conn.sendMessage(chatId, { react: { text: asDocument ? "📁" : "🎬", key: triggerMsg.key } });
  await conn.sendMessage(chatId, { text: `⏳ Enviando ${asDocument ? "como documento" : "video"}…` }, { quoted: baseMsg });

  const caption =
`⚡ 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 𝗩𝗶𝗱𝗲𝗼 — 𝗟𝗶𝘀𝘁𝗼
✦ 𝗧𝗶́𝘁𝘂𝗹𝗼: ${title}
✦ 𝗦𝗼𝘂𝗿𝗰𝗲: api-sky.ultraplus.click
`;

  const options = { quoted: baseMsg, caption };
  if (asDocument) {
    await conn.sendMessage(chatId, {
      document: { url: mediaUrl },
      mimetype: mime,
      fileName: `${title}.mp4`,
      ...options
    });
  } else {
    await conn.sendMessage(chatId, {
      video: { url: mediaUrl },
      mimetype: mime,
      ...options
    });
  }

  await conn.sendMessage(chatId, { react: { text: "✅", key: triggerMsg.key } });
}

const handler = async (msg, { conn, args, command }) => {
  const jid = msg.key.remoteJid;
  const url = (args.join(" ") || "").trim();
  const pref = global.prefixes?.[0] || ".";

  if (!url) {
    return conn.sendMessage(jid, {
      text: `✳️ *Usa:*\n${pref}${command} <url>\nEj: ${pref}${command} https://youtu.be/xxxxxx`
    }, { quoted: msg });
  }

  if (!isYouTube(url)) {
    return conn.sendMessage(jid, { text: "❌ *URL de YouTube inválida.*" }, { quoted: msg });
  }

  try {
    await conn.sendMessage(jid, { react: { text: "⏱️", key: msg.key } });
    const { mediaUrl, meta } = await fetchVideo(url);
    const title = meta.title || "YouTube Video";
    const dur = meta.duration ? fmtDur(meta.duration) : "—";

    const asDocument = meta.size && meta.size > 50_000_000; // Si mayor a 50MB envía como doc
    await sendVideo(conn, jid, mediaUrl, title, asDocument, msg, meta.mime, meta.size, msg);

  } catch (err) {
    console.error("ytmp4 error:", err?.message || err);
    try {
      await conn.sendMessage(jid, { text: `❌ ${err?.message || "Error procesando el enlace."}` }, { quoted: msg });
      await conn.sendMessage(jid, { react: { text: "❌", key: msg.key } });
    } catch {}
  }
};


handler.help = ["𝖸𝗍𝗆𝗉4 <𝗎𝗋𝗅>"]
handler.tags = ["𝖣𝖤𝖲𝖢𝖠𝖱𝖦𝖠𝖲"]
handler.command = ["ytmp4","ytv"];
export default handler;