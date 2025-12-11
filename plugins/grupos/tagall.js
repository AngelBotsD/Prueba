const DIGITS = (s = "") => String(s || "").replace(/\D/g, "");

const handler = async (msg, { conn }) => {
  try {
    const chatId = msg.key.remoteJid;
    const isGroup = chatId.endsWith("@g.us");
    const isFromMe = !!msg.key.fromMe;

    await conn.sendMessage(chatId, { react: { text: "🗣️", key: msg.key } }).catch(() => {});

    if (!isGroup) {
      return conn.sendMessage(chatId, { 
        text: "⚠️ *Este comando solo puede usarse en grupos.*" 
      }, { quoted: msg });
    }

    const senderId = msg.key.participant || msg.key.remoteJid;
    const senderRealJid = typeof msg.realJid === "string"
      ? msg.realJid
      : (senderId?.endsWith?.("@s.whatsapp.net") ? senderId : null);

    const senderDigits = DIGITS(senderRealJid || senderId);

    const isOwner = Array.isArray(global.owner) &&
      global.owner.some(([id]) => id === senderDigits);

    let meta;
    try {
      meta = await conn.groupMetadata(chatId);
    } catch {
      return conn.sendMessage(chatId, { text: "❌ No pude leer la metadata del grupo." }, { quoted: msg });
    }

    const participantes = Array.isArray(meta?.participants) ? meta.participants : [];

    const authorCandidates = new Set([
      senderId,
      senderRealJid,
      `${senderDigits}@s.whatsapp.net`,
      `${senderDigits}@lid`
    ].filter(Boolean));

    const isAdmin = participantes.some(p => {
      const ids = [
        p?.id,
        typeof p?.jid === "string" ? p.jid : ""
      ].filter(Boolean);
      const match = ids.some(id => authorCandidates.has(id) || DIGITS(id) === senderDigits);
      const adminOK = p?.admin === "admin" || p?.admin === "superadmin";
      return match && adminOK;
    });

    if (!isAdmin && !isOwner && !isFromMe) {
      return conn.sendMessage(chatId, {
        text: "🚫 *Este comando solo puede usarlo un administrador o el dueño del bot.*"
      }, { quoted: msg });
    }

    const mentionIdsRaw = participantes.map(p => p?.id || p?.jid).filter(Boolean);

    const seen = new Set();
    const mentionIds = [];
    for (const jid of mentionIdsRaw) {
      const d = DIGITS(jid);
      if (!seen.has(d)) {
        seen.add(d);
        mentionIds.push(jid);
      }
    }

    const total = mentionIds.length;

    let texto = `*!  MENCION GENERAL  !*\n`;
    texto += `   *PARA ${total} MIEMBROS* 🚩\n\n`;
    texto += mentionIds.map(id => `┊» 🚩 @${id.split("@")[0]}`).join("\n");

    await conn.sendMessage(chatId, { text: texto, mentions: mentionIds }, { quoted: msg });

  } catch {
    await conn.sendMessage(msg.key.remoteJid, { 
      text: "❌ Ocurrió un error al ejecutar el comando tagall." 
    }, { quoted: msg });
  }
};

handler.help = ["𝖳𝗈𝖽𝗈𝗌"];
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"];
handler.customPrefix = /^\.?(todos|invocar|invocacion|invocación)$/i;
handler.command = new RegExp();
handler.group = true;
handler.admin = true;
export default handler;