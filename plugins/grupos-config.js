const handler = async (msg, { conn, isAdmin, isBotAdmin }) => {
  const chat = msg.key.remoteJid;
  const body = msg.text?.trim().toLowerCase() || "";

  // ============ 1. CONFIGURAR STICKERS (.tovar abrir/cerrar) ============
  if (body.startsWith(".tovar")) {
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

    const sha = quoted.stickerMessage.fileSha256.toString("base64");

    global.stickersAcciones = global.stickersAcciones || {};
    global.stickersAcciones[sha] = accion;

    return conn.sendMessage(chat, { text: `Ese sticker ahora sirve para *${accion}* el grupo.` });
  }

  // ============ 2. DETECTAR SI SE MANDÓ UN STICKER =============
  const sticker = msg.message?.stickerMessage;
  if (!sticker) return;

  const sha = sticker.fileSha256?.toString("base64");
  if (!sha) return;

  // ============ 3. VER SI EL STICKER ESTÁ CONFIGURADO =============
  global.stickersAcciones = global.stickersAcciones || {};
  const accion = global.stickersAcciones[sha];

  if (!accion) return;

  // Solo admins pueden activarlo
  if (!isAdmin) {
    return conn.sendMessage(chat, { text: "Solo un admin puede usar este sticker." });
  }

  if (!isBotAdmin) {
    return conn.sendMessage(chat, { text: "No soy admin para cambiar los ajustes del grupo." });
  }

  // ============ 4. EJECUTAR ACCIÓN: ABRIR / CERRAR ============
  if (accion === "abrir") {
    await conn.groupSettingUpdate(chat, "not_announcement");
    return conn.sendMessage(chat, { text: "✔️ Grupo *abierto* por sticker." });
  }

  if (accion === "cerrar") {
    await conn.groupSettingUpdate(chat, "announcement");
    return conn.sendMessage(chat, { text: "✔️ Grupo *cerrado* por sticker." });
  }
};

handler.customPrefix = /^\.tovar/i;
handler.command = new RegExp();

export default handler;