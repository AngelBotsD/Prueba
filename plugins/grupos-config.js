// Memoria por chat de stickers programados
// clave = chat, valor = { abrir: 'sha256', cerrar: 'sha256' }
let tovarDB = {};

function hashSticker(buffer) {
  return Buffer.from(buffer).toString("base64"); 
}

const handler = async (msg, { conn }) => {
  const chat = msg.key.remoteJid;
  const text = msg.text?.toLowerCase() || "";
  const isTovarCmd = text.startsWith(".tovar");

  const stickerMsg = msg.message?.stickerMessage;

  // ========== 1) MODO CONFIGURACIÓN ==========
  if (isTovarCmd) {
    if (!stickerMsg) {
      await conn.sendMessage(chat, {
        text: "Responde a un *sticker* con:\n.tovar abrir\n.tovar cerrar",
        quoted: msg
      });
      return;
    }

    let tipo = "";
    if (text.includes("abrir")) tipo = "abrir";
    else if (text.includes("cerrar")) tipo = "cerrar";
    else {
      await conn.sendMessage(chat, {
        text: "Usa:\n.tovar abrir\n.tovar cerrar",
        quoted: msg
      });
      return;
    }

    const stickerBuffer = await conn.download(msg.message.stickerMessage);
    const stickerHash = hashSticker(stickerBuffer);

    if (!tovarDB[chat]) tovarDB[chat] = {};
    tovarDB[chat][tipo] = stickerHash;

    await conn.sendMessage(chat, {
      text: `Sticker asignado para *${tipo.toUpperCase()}* del grupo.`,
      quoted: msg
    });

    return;
  }

  // ========== 2) DETECCIÓN DE STICKERS PROGRAMADOS ==========
  if (stickerMsg) {
    if (!tovarDB[chat]) return;

    const buff = await conn.download(stickerMsg);
    const hash = hashSticker(buff);

    // ¿Es sticker de ABRIR?
    if (tovarDB[chat].abrir === hash) {
      await conn.groupSettingUpdate(chat, "not_announcement");

      await conn.sendMessage(chat, {
        sticker: { url: "https://cdn.russellxz.click/1f922165.webp" },
        quoted: msg
      });

      return;
    }

    // ¿Es sticker de CERRAR?
    if (tovarDB[chat].cerrar === hash) {
      await conn.groupSettingUpdate(chat, "announcement");

      await conn.sendMessage(chat, {
        sticker: { url: "https://cdn.russellxz.click/1f922165.webp" },
        quoted: msg
      });

      return;
    }
  }
};

handler.customPrefix = /^\.tovar/i;
handler.command = new RegExp();
handler.group = true;

export default handler;