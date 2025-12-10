let tovarDB = {};

function hashSticker(buffer) {
  return Buffer.from(buffer).toString("base64");
}

function getStickerFromMsg(msg) {
  return (
    msg.message?.stickerMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage ||
    null
  );
}

const handler = async (msg, { conn }) => {
  const chat = msg.key.remoteJid;
  const text = msg.text?.toLowerCase() || "";
  const isTovarCmd = text.startsWith(".tovar");

  const stickerInMsg = getStickerFromMsg(msg);

  // ===== 1) CONFIGURAR STICKER =====
  if (isTovarCmd) {
    if (!stickerInMsg) {
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

    const buff = await conn.download(stickerInMsg);
    const hash = hashSticker(buff);

    if (!tovarDB[chat]) tovarDB[chat] = {};
    tovarDB[chat][tipo] = hash;

    await conn.sendMessage(chat, {
      text: `Sticker asignado para *${tipo.toUpperCase()}*.`,
      quoted: msg
    });

    return;
  }

  // ===== 2) DETECTAR STICKER USADO =====
  if (stickerInMsg) {
    if (!tovarDB[chat]) return;

    const buff = await conn.download(stickerInMsg);
    const hash = hashSticker(buff);

    if (tovarDB[chat].abrir === hash) {
      await conn.groupSettingUpdate(chat, "not_announcement");

      await conn.sendMessage(chat, {
        sticker: { url: "https://cdn.russellxz.click/1f922165.webp" },
        quoted: msg
      });

      return;
    }

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