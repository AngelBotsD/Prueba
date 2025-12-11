const API_BASE = process.env.API_BASE || "https://api-sky.ultraplus.click";
const API_KEY = process.env.API_KEY || "Russellxz";
const MAX_TIMEOUT = 25000;

const pendingTT = Object.create(null);

const fmtSec = s => {
  const n = Number(s || 0);
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const sec = n % 60;
  return (h ? `${h}:` : "") + `${m.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`;
};

async function getTikTokFromSky(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAX_TIMEOUT);

  try {
    const res = await fetch(`${API_BASE}/api/download/tiktok.php?url=${encodeURIComponent(url)}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      signal: controller.signal
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status} - ${data?.error || "Error desconocido"}`);
    if (data.status !== "true" || !data.data?.video) throw new Error(data?.error || "La API no devolvió un video válido.");
    return data.data;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendTikTok(conn, { chatId, url, caption, quotedBase }, asDocument, triggerMsg) {
  await conn.sendMessage(chatId, { react: { text: asDocument ? "📁" : "🎬", key: triggerMsg.key } });
  await conn.sendMessage(chatId, { text: `⏳ Enviando ${asDocument ? "como documento" : "video"}…` }, { quoted: quotedBase });
  
  const message = asDocument
    ? { document: { url }, mimetype: "video/mp4", fileName: `tiktok-${Date.now()}.mp4` }
    : { video: { url }, mimetype: "video/mp4", caption };

  await conn.sendMessage(chatId, message, { quoted: quotedBase });
  await conn.sendMessage(chatId, { react: { text: "✅", key: triggerMsg.key } });
}

function setupTTListener(conn) {
  if (conn._ttListener) return;
  conn._ttListener = true;

  conn.ev.on("messages.upsert", async ev => {
    for (const m of ev.messages) {
      if (!m.message) continue;

      try {
        if (m.message.reactionMessage) {
          const { key: reactKey, text: emoji } = m.message.reactionMessage;
          const job = pendingTT[reactKey.id];
          if (job) {
            await sendTikTok(conn, job, emoji === "❤️", m);
            delete pendingTT[reactKey.id];
          }
        }

        const ctx = m.message.extendedTextMessage?.contextInfo;
        const replyTo = ctx?.stanzaId;
        const textLow = (m.message.conversation || m.message.extendedTextMessage?.text || "").trim().toLowerCase();

        if (replyTo && pendingTT[replyTo]) {
          const job = pendingTT[replyTo];
          if (textLow === "1" || textLow === "2") {
            await sendTikTok(conn, job, textLow === "2", m);
            delete pendingTT[replyTo];
          } else {
            await conn.sendMessage(job.chatId, { text: "⚠️ Responde con *1* (video) o *2* (documento), o reacciona con 👍 / ❤️." }, { quoted: job.quotedBase });
          }
        }
      } catch (err) {
        console.error("TT listener error:", err);
      }
    }
  });
}

const handler = async (msg, { conn, args, command }) => {
  const chatId = msg.key.remoteJid;
  const text = (args || []).join("");
  const pref = (global.prefixes?.[0]) || ".";

  if (!text) return conn.sendMessage(chatId, { text: `✳️ 𝙐𝙨𝙖:\n${pref}${command} <enlace>\nEj: ${pref}${command} https://vm.tiktok.com/xxxxxx/` }, { quoted: msg });

  const url = args[0];
  if (!/^https?:\/\//i.test(url) || !/tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com/i.test(url)) {
    return conn.sendMessage(chatId, { text: "❌ 𝙀𝙣𝙡𝙖𝙘𝙚 𝙙𝙚 𝙏𝙞𝙠𝙏𝙤𝙠 𝙞𝙣𝙫𝙖́𝙡𝙞𝙙𝙤." }, { quoted: msg });
  }

  try {
    await conn.sendMessage(chatId, { react: { text: "⏱️", key: msg.key } });
    const d = await getTikTokFromSky(url);

    const { title = "TikTok", author: authObj, duration, likes = 0, comments = 0, video } = d;
    const author = authObj?.name || authObj?.username || "—";
    const durTxt = duration ? fmtSec(duration) : "—";

    const txt =
`⚡ 𝗧𝗶𝗸𝗧𝗼𝗸 — 𝗼𝗽𝗰𝗶𝗼𝗻𝗲𝘀

Elige cómo enviarlo:
👍 𝗩𝗶𝗱𝗲𝗼 (normal)
❤️ 𝗩𝗶𝗱𝗲𝗼 𝗰𝗼𝗺𝗼 𝗱𝗼𝗰𝘂𝗺𝗲𝗻𝘁𝗼
— 𝗼 responde: 1 = video · 2 = documento

✦ 𝗧𝗶́𝘁𝘂𝗹𝗼: ${title}
✦ 𝗔𝘂𝘁𝗼𝗿: ${author}
✦ 𝗗𝘂𝗿.: ${durTxt} • 👍 ${likes} · 💬 ${comments}
✦ 𝗦𝗼𝘂𝗿𝗰𝗲: api-sky.ultraplus.click
────────────`;

    const preview = await conn.sendMessage(chatId, { text: txt }, { quoted: msg });

    pendingTT[preview.key.id] = {
      chatId,
      url: video,
      caption:
`⚡ 𝗧𝗶𝗸𝗧𝗼𝗸 — 𝘃𝗶𝗱𝗲𝗼 𝗹𝗶𝘀𝘁𝗼

✦ 𝗧𝗶́𝘁𝘂𝗹𝗼: ${title}
✦ 𝗔𝘂𝘁𝗼𝗿: ${author}
✦ 𝗗𝘂𝗿𝗮𝗰𝗶𝗼́𝗻: ${durTxt}
✦ 𝗟𝗶𝗸𝗲𝘀: ${likes}  •  𝗖𝗼𝗺𝗲𝗻𝘁𝗮𝗿𝗶𝗼𝘀: ${comments}

✦ 𝗦𝗼𝘂𝗿𝗰𝗲: api-sky.ultraplus.click
────────────`,
      quotedBase: msg
    };

    await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    setupTTListener(conn);
  } catch (err) {
    console.error("❌ Error en tt:", err?.message || err);
    await conn.sendMessage(chatId, { text: `❌ *Error:* ${err?.message || "Fallo al procesar el TikTok."}`, quoted: msg });
    await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
  }
};

handler.help = ["𝖳𝗂𝗄𝗍𝗈𝗄 <𝗎𝗋𝗅>"]
handler.tags = ["𝖣𝖤𝖲𝖢𝖠𝖱𝖦𝖠𝖲"]
handler.command = ["tiktok", "tt"];
export default handler;