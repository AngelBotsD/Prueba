import axios from "axios";

const API_BASE = process.env.API_BASE || "https://api-sky.ultraplus.click";
const API_KEY  = process.env.API_KEY  || "Russellxz";

const AXIOS_TIMEOUT = 0;
axios.defaults.timeout = AXIOS_TIMEOUT;
axios.defaults.maxBodyLength = Infinity;
axios.defaults.maxContentLength = Infinity;

function isYouTube(u) {
  return /^https?:\/\//i.test(u) && /(youtube.com|youtu.be|music.youtube.com)/i.test(u);
}

function fmtDur(s) {
  const n = Number(s || 0);
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const sec = n % 60;
  return (h ? `${h}:` : "") + `${m.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const pendingYTV = Object.create(null);

async function callSkyYtVideo(url){
  const endpoints = ["/api/download/yt.js", "/api/download/yt.php"];
  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    "X-API-Key": API_KEY,
    Accept: "application/json"
  };
  const params = { url, format: "video" };

  let lastErr = null;

  for (const ep of endpoints) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await axios.get(`${API_BASE}${ep}`, {
          params,
          headers,
          timeout: AXIOS_TIMEOUT,
          maxRedirects: 5,
          validateStatus: () => true
        });

        if (r.status >= 500 || r.status === 429 || r.status === 403) {  
          lastErr = new Error(`HTTP ${r.status}${r.data?.error ? ` - ${r.data.error}` : ""}`);  
          await sleep(1000 * attempt);  
          continue;  
        }  

        if (r.status !== 200) {  
          lastErr = new Error(`HTTP ${r.status}`);  
          await sleep(1000 * attempt);  
          continue;  
        }  

        const ok = r.data && r.data.status === "true" && r.data.data;  
        if (!ok) {  
          lastErr = new Error(`API inválida: ${JSON.stringify(r.data)}`);  
          await sleep(1000 * attempt);  
          continue;  
        }  

        const d = r.data.data || {};  
        const mediaUrl = d.video || d.audio;  
        if (!mediaUrl) {  
          lastErr = new Error("El API no devolvió video.");  
          await sleep(1000 * attempt);  
          continue;  
        }  

        return { mediaUrl, meta: d };  
      } catch (e) {  
        lastErr = e;  
        await sleep(1000 * attempt);  
      }  
    }
  }

  throw lastErr || new Error("No se pudo obtener el video.");
}

const handler = async (msg, { conn, args, command }) => {
  const jid  = msg.key.remoteJid;
  const url  = (args.join(" ") || "").trim();
  const pref = global.prefixes?.[0] || ".";

  if (!url) {
    return conn.sendMessage(jid, {
      text: `✳️ *Usa:*\n${pref}${command} <url>\nEj: ${pref}${command} https://youtu.be/xxxxxx`
    }, { quoted: msg });
  }
  if (!isYouTube(url)) {
    return conn.sendMessage(jid, { text: "❌ URL de YouTube inválida." }, { quoted: msg });
  }

  try {
    await conn.sendMessage(jid, { react: { text: "⏱️", key: msg.key } });

    const { mediaUrl, meta } = await callSkyYtVideo(url);  
    const title = meta.title || "YouTube Video";  
    const dur   = meta.duration ? fmtDur(meta.duration) : "—";  
    const thumb = meta.thumbnail || "";  

    const caption =
      `⚡ 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 — 𝗩𝗶𝗱𝗲𝗼

Elige cómo enviarlo:
👍 𝗩𝗶𝗱𝗲𝗼 (normal)
❤️ 𝗩𝗶𝗱𝗲𝗼 𝗰𝗼𝗺𝗼 𝗱𝗼𝗰𝘂𝗺𝗲𝗻𝘁𝗼
— 𝗼 responde: 1 = video · 2 = documento

✦ 𝗧𝗶́𝘁𝘂𝗹𝗼: ${title}
✦ 𝗗𝘂𝗿𝗮𝗰𝗶𝗼́𝗻: ${dur}
✦ 𝗦𝗼𝘂𝗿𝗰𝗲: api-sky.ultraplus.click
────────────
`;

    let selectorMsg;  
    if (thumb) {  
      selectorMsg = await conn.sendMessage(jid, { image: { url: thumb }, caption }, { quoted: msg });  
    } else {  
      selectorMsg = await conn.sendMessage(jid, { text: caption }, { quoted: msg });  
    }  

    pendingYTV[selectorMsg.key.id] = {  
      chatId: jid,  
      mediaUrl,  
      title,  
      baseMsg: msg  
    };  

    await conn.sendMessage(jid, { react: { text: "✅", key: msg.key } });  

    if (!conn._ytvListener) {  
      conn._ytvListener = true;  
      conn.ev.on("messages.upsert", async (ev) => {  
        for (const m of ev.messages) {  
          try {  
            if (m.message?.reactionMessage) {  
              const { key: reactedKey, text: emoji } = m.message.reactionMessage;  
              const job = pendingYTV[reactedKey.id];  
              if (job) {  
                const asDoc = emoji === "❤️";  
                await sendVideo(conn, job, asDoc, m);  
                delete pendingYTV[reactedKey.id];  
              }  
            }  

            const ctx = m.message?.extendedTextMessage?.contextInfo;  
            const replyTo = ctx?.stanzaId;  
            const txt = (m.message?.conversation || m.message?.extendedTextMessage?.text || "").trim().toLowerCase();  
            if (replyTo && pendingYTV[replyTo]) {  
              const job = pendingYTV[replyTo];  
              if (txt === "1" || txt === "2") {  
                const asDoc = txt === "2";  
                await sendVideo(conn, job, asDoc, m);  
                delete pendingYTV[replyTo];  
              } else if (txt) {  
                await conn.sendMessage(job.chatId, {  
                  text: "⚠️ Responde con *1* (video) o *2* (documento), o reacciona con 👍 / ❤️."  
                }, { quoted: job.baseMsg });  
              }  
            }  
          } catch (e) {  
            console.error("ytmp4 listener error:", e);  
          }  
        }  
      });  
    }

  } catch (err) {
    console.error("ytmp4 error:", err?.message || err);
    try {
      await conn.sendMessage(jid, { text: `❌ ${err?.message || "Error procesando el enlace."}` }, { quoted: msg });
      await conn.sendMessage(jid, { react: { text: "❌", key: msg.key } });
    } catch {}
  }
};

async function sendVideo(conn, job, asDocument, triggerMsg){
  const { chatId, mediaUrl, title, baseMsg } = job;

  await conn.sendMessage(chatId, { react: { text: asDocument ? "📁" : "🎬", key: triggerMsg.key } });
  await conn.sendMessage(chatId, { text: `⏳ Enviando ${asDocument ? "como documento" : "video"}…` }, { quoted: baseMsg });

  const caption =
    `⚡ 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 𝗩𝗶𝗱𝗲𝗼 — 𝗟𝗶𝘀𝘁𝗼

✦ 𝗧𝗶́𝘁𝘂𝗹𝗼: ${title}
✦ 𝗦𝗼𝘂𝗿𝗰𝗲: api-sky.ultraplus.click
`;

  if (asDocument) {
    await conn.sendMessage(chatId, {
      document: { url: mediaUrl },
      mimetype: "video/mp4",
      fileName: `${title}.mp4`,
      caption
    }, { quoted: baseMsg });
  } else {
    await conn.sendMessage(chatId, {
      video: { url: mediaUrl },
      mimetype: "video/mp4",
      caption
    }, { quoted: baseMsg });
  }

  await conn.sendMessage(chatId, { react: { text: "✅", key: triggerMsg.key } });
}

handler.command = ["ytmp4","ytv"];
handler.help = ["𝖸𝗍𝗆𝗉4 <𝗎𝗋𝗅>"];
handler.tags = ["𝖣𝖤𝖲𝖢𝖠𝖱𝖦𝖠𝖲"];
export default handler;