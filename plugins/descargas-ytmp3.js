import axios from "axios";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";

const API_BASE = process.env.API_BASE || "https://api-sky.ultraplus.click";
const API_KEY = process.env.API_KEY || "Russellxz";

const isYouTube = (u = "") =>
  /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//i.test(u);

const fmtSec = (s) => {
  const n = Number(s || 0);
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const sec = n % 60;
  return (h ? `${h}:` : "") + `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
};

const pendingYTA = Object.create(null);

async function getYTFromSkyAudio(url) {
  const { data: api, status: http } = await axios.get(
    `${API_BASE}/api/download/yt.php`,
    {
      params: { url, format: "audio" },
      headers: { Authorization: `Bearer ${API_KEY}` },
      timeout: 30000,
      validateStatus: (s) => s >= 200 && s < 600
    }
  );
  if (http !== 200 || !api || api.status !== "true" || !api.data?.audio) {
    const msgErr = api?.error || `HTTP ${http}`;
    throw new Error(`No se pudo obtener audio (${msgErr}).`);
  }
  return api.data;
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

const handler = async (msg, { conn, text, usedPrefix, command }) => {
  const chatId = msg.key.remoteJid;
  const pref = (global.prefixes && global.prefixes[0]) || usedPrefix || ".";

  if (!text || !isYouTube(text)) {
    return conn.sendMessage(
      chatId,
      {
        text: `✳️ 𝙐𝙨𝙤 𝙘𝙤𝙧𝙧𝙚𝙘𝙩𝙤:
${pref}${command} <enlace de YouTube>

📌 𝙀𝙟𝙚𝙢𝙥𝙡𝙤:
${pref}${command} https://youtu.be/dQw4w9WgXcQ`
      },
      { quoted: msg }
    );
  }

  await conn.sendMessage(chatId, { react: { text: "⏳", key: msg.key } });

  try {
    const d = await getYTFromSkyAudio(text);
    const title = d.title || "YouTube";
    const durationTxt = d.duration ? fmtSec(d.duration) : "—";
    const thumb = d.thumbnail || "";
    const audioSrc = String(d.audio);

    const caption = `⚡ 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 — 𝗔𝘂𝗱𝗶𝗼

Elige cómo enviarlo:
👍 𝗔𝘂𝗱𝗶𝗼 (normal)
❤️ 𝗔𝘂𝗱𝗶𝗼 𝗰𝗼𝗺𝗼 𝗱𝗼𝗰𝘂𝗺𝗲𝗻𝘁𝗼
— 𝗼 responde: 1 = audio · 2 = documento

✦ 𝗧𝗶́𝘁𝘂𝗹𝗼: ${title}
✦ 𝗗𝘂𝗿𝗮𝗰𝗶𝗼𝗻: ${durationTxt}
✦ 𝗦𝗼𝘂𝗿𝗰𝗲: api-sky.ultraplus.click
────────────
`;

    let preview;

    if (thumb) {
      preview = await conn.sendMessage(
        chatId,
        { image: { url: thumb }, caption },
        { quoted: msg }
      );
    } else {
      preview = await conn.sendMessage(chatId, { text: caption }, { quoted: msg });
    }

    pendingYTA[preview.key.id] = {
      chatId,
      audioSrc,
      title,
      durationTxt,
      quotedBase: msg
    };

    await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    if (!conn._ytaListener) {
      conn._ytaListener = true;
      conn.ev.on("messages.upsert", async (ev) => {
        for (const m of ev.messages) {
          try {
            if (m.message?.reactionMessage) {
              const { key: reactKey, text: emoji } = m.message.reactionMessage;
              const job = pendingYTA[reactKey.id];
              if (job) {
                const asDoc = emoji === "❤️";
                await sendMp3(conn, job, asDoc, m);
                delete pendingYTA[reactKey.id];
              }
            }

            const ctx = m.message?.extendedTextMessage?.contextInfo;
            const replyTo = ctx?.stanzaId;
            const textLow =
              (m.message?.conversation ||
                m.message?.extendedTextMessage?.text ||
                "").trim().toLowerCase();

            if (replyTo && pendingYTA[replyTo]) {
              const job = pendingYTA[replyTo];
              if (textLow === "1" || textLow === "2") {
                const asDoc = textLow === "2";
                await sendMp3(conn, job, asDoc, m);
                delete pendingYTA[replyTo];
              } else {
                await conn.sendMessage(
                  job.chatId,
                  {
                    text: "⚠️ Responde con *1* (audio) o *2* (documento), o reacciona con 👍 / ❤️."
                  },
                  { quoted: job.quotedBase }
                );
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
    await conn.sendMessage(
      chatId,
      {
        text: `❌ *Error:* ${err?.message || "Fallo al procesar el audio."}`
      },
      { quoted: msg }
    );
    await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
  }
};

async function sendMp3(conn, job, asDocument, triggerMsg) {
  const { chatId, audioSrc, title, durationTxt, quotedBase } = job;

  await conn.sendMessage(chatId, { react: { text: asDocument ? "📄" : "🎵", key: triggerMsg.key } });

  await conn.sendMessage(
    chatId,
    { text: `⏳ Enviando ${asDocument ? "como documento" : "audio"}…` },
    { quoted: quotedBase }
  );

  const filePath = await transcodeToMp3Tmp(audioSrc, `ytmp3-${Date.now()}.mp3`);

  const caption = `🎵 𝗬𝗧 𝗠𝗣𝟯 — 𝗟𝗶𝘀𝘁𝗼

✦ 𝗧𝗶́𝘁𝘂𝗹𝗼: ${title}
✦ 𝗗𝘂𝗿𝗮𝗰𝗶𝗼𝗻: ${durationTxt}
✦ 𝗦𝗼𝘂𝗿𝗰𝗲: api-sky.ultraplus.click
`;

  const buf = fs.readFileSync(filePath);

  if (asDocument) {
    await conn.sendMessage(
      chatId,
      {
        document: buf,
        mimetype: "audio/mpeg",
        fileName: `${title}.mp3`,
        caption
      },
      { quoted: quotedBase }
    );
  } else {
    await conn.sendMessage(
      chatId,
      {
        audio: buf,
        mimetype: "audio/mpeg",
        fileName: `${title}.mp3`,
        caption
      },
      { quoted: quotedBase }
    );
  }

  try {
    fs.unlinkSync(filePath);
  } catch {}

  await conn.sendMessage(chatId, { react: { text: "✅", key: triggerMsg.key } });
}

handler.command = ["ytmp3", "yta"];
handler.help     = ["𝖸𝗍𝗆𝗉3 <𝗎𝗋𝗅>"];
handler.tags     = ["𝖣𝖤𝖲𝖢𝖠𝖱𝖦𝖠𝖲"];

export default handler;