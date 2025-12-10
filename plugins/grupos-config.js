let handler = async (m, { conn }) => {
  const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const st = quoted?.stickerMessage;

  if (!st) return conn.sendMessage(m.chat, { text: "Responde a un sticker." });

  const base64 = st.fileSha256.toString("base64");

  return conn.sendMessage(m.chat, {
    text: `🆔 ID BASE64:\n\`\`\`${base64}\`\`\``
  }, { quoted: m });
};

handler.command = ["id64"];
export default handler;