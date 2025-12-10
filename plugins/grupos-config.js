const handler = async (msg, { conn }) => {
  const chat = msg.key.remoteJid;

  // Ver si respondió a un sticker
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const sticker = quoted?.stickerMessage;

  if (!sticker) {
    return conn.sendMessage(chat, {
      text: "Responde a un *sticker* con el comando `.id`"
    }, { quoted: msg });
  }

  // Obtener SHA256
  const sha = sticker.fileSha256?.toString("base64");

  if (!sha) {
    return conn.sendMessage(chat, {
      text: "No pude obtener el ID del sticker."
    }, { quoted: msg });
  }

  // Responder con el ID
  return conn.sendMessage(chat, {
    text: `🆔 *ID del sticker:*\n\`\`\`${sha}\`\`\``
  }, { quoted: msg });
};

handler.command = ["id"];
export default handler;