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

    const data = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status} - ${data?.error || "Error desconocido"}`);
    if (data.status !== "true" || !data.data?.video) throw new Error(data?.error || "La API no devolvió video.");

    return data.data;
  } finally {
    clearTimeout(timeout);
  }
}

const handler = async (msg, { conn, args, command }) => {
  const chatId = msg.key.remoteJid;
  const text = (args || []).join("");

  if (!text)
    return conn.sendMessage(chatId, { 
      text: `✳️ Usa:\n.${command} <link>\nEj: .${command} https://vm.tiktok.com/xxxx` 
    }, { quoted: msg });

  const url = args[0];
  if (!/^https?:\/\//i.test(url) || !/tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com/i.test(url)) {
    return conn.sendMessage(chatId, { text: "❌ Enlace de TikTok inválido." }, { quoted: msg });
  }

  try {
    await conn.sendMessage(chatId, { react: { text: "⏱️", key: msg.key } });

    const d = await getTikTok(url);

    const {
      title = "TikTok",
      author: authObj,
      duration,
      likes = 0,
      comments = 0,
      video
    } = d;

    const author = authObj?.name || authObj?.username || "—";
    const dur = duration ? fmtSec(duration) : "—";

    const caption =
`⚡ 𝗧𝗶𝗸𝗧𝗼𝗸 — 𝗱𝗲𝘀𝗰𝗮𝗿𝗴𝗮 𝗹𝗶𝘀𝘁𝗮

✦ 𝗧𝗶́𝘁𝘂𝗹𝗼: ${title}
✦ 𝗔𝘂𝘁𝗼𝗿: ${author}
✦ 𝗗𝘂𝗿𝗮𝗰𝗶𝗼́𝗻: ${dur}
✦ 𝗟𝗶𝗸𝗲𝘀: ${likes}  •  𝗖𝗼𝗺𝗲𝗻𝘁𝗮𝗿𝗶𝗼𝘀: ${comments}
`;

    // 🔥 ENVÍO DIRECTO DEL VIDEO
    await conn.sendMessage(chatId, { 
      video: { url: video }, 
      mimetype: "video/mp4",
      caption 
    }, { quoted: msg });

    await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

  } catch (err) {
    console.error("❌ Error en TikTok:", err);
    await conn.sendMessage(chatId, { 
      text: `❌ Error: ${err?.message || "No se pudo descargar."}` 
    }, { quoted: msg });
    await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
  }
};

handler.command = ["tiktok", "tt"];
handler.help = ["tiktok <url>", "tt <url>"];
handler.tags = ["descargas"];

export default handler;