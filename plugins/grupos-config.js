const DIGITS = (s = "") => String(s || "").replace(/\D/g, "");

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const body = msg.text?.toLowerCase() || "";

  const abrir = /\b(abrir|open)\b/.test(body) || /(abrir|open).*(grupo)/.test(body);
  const cerrar = /\b(cerrar|close)\b/.test(body) || /(cerrar|close).*(grupo)/.test(body);

  if (!abrir && !cerrar) {
    return conn.sendMessage(chatId, { text: "❌ Debes especificar abrir o cerrar el grupo." }, { quoted: msg });
  }

  try {
    await conn.sendMessage(chatId, { react: { text: abrir ? "🔐" : "🔒", key: msg.key } });
  } catch {}

  try {
    await conn.groupSettingUpdate(chatId, abrir ? "not_announcement" : "announcement");

    return conn.sendMessage(chatId, {
      text: abrir
        ? "𝖤𝗅 𝖦𝗋𝗎𝗉𝗈 𝖧𝖺 𝖲𝗂𝖽𝗈 𝖠𝖻𝗂𝖾𝗋𝗍𝗈 𝖢𝗈𝗋𝗋𝖾𝖼𝗍𝖺𝗆𝖾𝗇𝗍𝖾 🔓."
        : "𝖤𝗅 𝖦𝗋𝗎𝗉𝗈 𝖧𝖺 𝖲𝗂𝖽𝗈 𝖢𝖾𝗋𝗋𝖺𝖽𝗈 𝖢𝗈𝗋𝗋𝖾𝖼𝗍𝖺𝗆𝖾𝗇𝗍𝖾🔒."
    }, { quoted: msg });

  } catch {
    return conn.sendMessage(chatId, {
      text: abrir ? "❌ No pude abrir el grupo." : "❌ No pude cerrar el grupo."
    }, { quoted: msg });
  }
};



handler.help = ["𝖦𝗋𝗎𝗉𝗈 𝖠𝖻𝗋𝗂𝗋", "𝖦𝗋𝗎𝗉𝗈 𝖢𝖾𝗋𝗋𝖺𝗋"]
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"];
handler.group = true;
handler.admin = true;
handler.command = new RegExp();
handler.customPrefix = /^(?:\.?grupo\s(?:abrir|cerrar|open|close)|\.?grupo\b|\.?(?:abrir|cerrar|open|close)(?:\s+el\s+grupo|\s+grupo)?)$/i;
export default handler;