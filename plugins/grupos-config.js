const handler = async (msg, { conn }) => {
  const body = msg.text?.trim().toLowerCase() || "";
  const chat = msg.key.remoteJid;

  if (!body.startsWith(".tovar")) return;

  const args = body.split(" ");
  const accion = args[1]; // abrir / cerrar

  if (!["abrir", "cerrar"].includes(accion)) {
    return conn.sendMessage(chat, { text: "Usa:\n.tovar abrir\n.tovar cerrar" });
  }

  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const isSticker = quoted?.stickerMessage ? true : false;

  if (!isSticker) {
    return conn.sendMessage(chat, { text: "Responde a un *sticker* con:\n.tovar abrir\n.tovar cerrar" });
  }

  const stickerSha = quoted.stickerMessage.fileSha256.toString("base64");

  global.stickersAcciones = global.stickersAcciones || {};
  global.stickersAcciones[stickerSha] = accion;

  return conn.sendMessage(chat, { text: `Listo. Ese sticker ahora sirve para *${accion}* el grupo.` });
};
handler.customPrefix = /^\.tovar/i;
handler.command = new RegExp();

export default handler;