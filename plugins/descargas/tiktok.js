const API_BASE = process.env.API_BASE || "https://api-sky.ultraplus.click";
const API_KEY = process.env.API_KEY || "Russellxz";
const MAX_TIMEOUT = 25000;

const fmtSec = s => {
  const n = Number(s || 0);
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const sec = n % 60;
  return (h ? `${h}:` : "") + `${m.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`;
};

async function getTikTok(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAX_TIMEOUT);

  try {
    const res = await fetch(`${API_BASE}/api/download/tiktok.php?url=${encodeURIComponent(url)}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      signal: controller.signal
    });

    const contentType = res.headers.get("content-type") || "";

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    if (contentType.includes("application/json")) {
      const data = await res.json();
      if (data.status !== "true" || !data.data?.video) throw new Error(data?.error || "La API no devolvió un video válido.");
      return data.data;
    } else {
      const text = await res.text();
      throw new Error("La API no devolvió JSON válido:\n" + text.slice(0, 200));
    }

  } finally {
    clearTimeout(timeout);
  }
}

const handler = async (msg, { conn, args, command }) => {
  const chatId = msg.key.remoteJid;
  const pref = global.prefixes?.[0] || ".";
  const url = args?.[0];

  if (!url) return conn.sendMessage(chatId, { text: `✳️ 𝙐𝙨𝙖:\n${pref}${command} <enlace>\nEj: ${pref}${command} https://vm.tiktok.com/xxxxxx/` }, { quoted: msg });
  if (!/^https?:\/\//i.test(url) || !/tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com/i.test(url)) {
    return conn.sendMessage(chatId, { text: "❌ 𝙀𝙣𝙡𝙖𝙘𝙚 𝙙𝙚 𝙏𝙞𝙠𝙏𝙤𝙠 𝙞𝙣𝙫𝙖́𝙡𝙞𝙙𝙤." }, { quoted: msg });
  }

  try {
    await conn.sendMessage(chatId, { react: { text: "⏱️", key: msg.key } });

    const { title = "TikTok", author: authObj, duration, likes = 0, comments = 0, video } = await getTikTok(url);
    const author = authObj?.name || authObj?.username || "—";
    const durTxt = duration ? fmtSec(duration) : "—";

    const caption =
`⚡ 𝗧𝗶𝗸𝗧𝗼𝗸

✦ 𝗧𝗶́𝘁𝘂𝗹𝗼: ${title}
✦ 𝗔𝘂𝘁𝗼𝗿: ${author}
✦ 𝗗𝘂𝗿.: ${durTxt} • 👍 ${likes} · 💬 ${comments}
✦ 𝗦𝗼𝘂𝗿𝗰𝗲: api-sky.ultraplus.click
────────────
🤖 𝙎𝙪𝙠𝙞 𝘽𝙤𝙩`;

    await conn.sendMessage(chatId, { video: { url }, mimetype: "video/mp4", caption, quoted: msg });
    await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

  } catch (err) {
    console.error("❌ Error en tt:", err);
    await conn.sendMessage(chatId, { text: `❌ *Error:* ${err.message || "Fallo al procesar el TikTok."}`, quoted: msg });
    await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
  }
};

handler.command = ["tiktok", "tt"];
handler.help = ["tiktok <url>", "tt <url>"];
handler.tags = ["descargas"];

export default handler;