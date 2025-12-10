import fs from "fs";
import path from "path";

const dbPath = path.resolve("./tovar.json");

// Cargar JSON (si no existe lo crea automáticamente)
function loadDB() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, "{}");  // ← aquí se crea automáticamente
  }

  const content = fs.readFileSync(dbPath, "utf8") || "{}";

  try {
    return JSON.parse(content);
  } catch {
    fs.writeFileSync(dbPath, "{}");
    return {};
  }
}

// Guardar JSON
function saveDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

const handler = async (msg, { conn, isAdmin, isBotAdmin }) => {
  const chat = msg.key.remoteJid;

  // =============================================
  // 1. Cuando mandan un sticker, verificar si tiene acción
  // =============================================
  const sticker = msg.message?.stickerMessage;
  if (sticker) {
    const sha = sticker.fileSha256?.toString("base64");
    const db = loadDB();
    const accion = db[sha];

    if (!accion) return; // sticker NO vinculado, no hacer nada

    if (!isAdmin) {
      return conn.sendMessage(chat, { text: "Sólo un admin puede usar este sticker." });
    }

    if (!isBotAdmin) {
      return conn.sendMessage(chat, { text: "Necesito admin para modificar el grupo." });
    }

    if (accion === "abrir") {
      await conn.groupSettingUpdate(chat, "not_announcement");
      return conn.sendMessage(chat, { text: "✔ *Grupo ABIERTO* por sticker." });
    }

    if (accion === "cerrar") {
      await conn.groupSettingUpdate(chat, "announcement");
      return conn.sendMessage(chat, { text: "✔ *Grupo CERRADO* por sticker." });
    }

    return;
  }

  // =============================================
  // 2. Comando .tovar abrir / .tovar cerrar
  // =============================================
  const text = msg.text?.trim().toLowerCase() || "";
  if (!text.startsWith(".tovar")) return;

  const args = text.split(" ");
  const accion = args[1];

  if (!["abrir", "cerrar"].includes(accion)) {
    return conn.sendMessage(chat, {
      text: "Usa:\n.tovar abrir\n.tovar cerrar\n(respondiendo a un sticker)"
    });
  }

  // Debe responder a un sticker
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const quotedSticker = quoted?.stickerMessage;

  if (!quotedSticker) {
    return conn.sendMessage(chat, {
      text: "Responde a un *sticker* con:\n.tovar abrir\n.tovar cerrar"
    });
  }

  const sha = quotedSticker.fileSha256?.toString("base64");
  if (!sha) {
    return conn.sendMessage(chat, { text: "No se pudo obtener el ID del sticker." });
  }

  // Guardar en JSON automáticamente
  const db = loadDB();
  db[sha] = accion;
  saveDB(db);

  return conn.sendMessage(chat, {
    text: `Ese sticker ahora sirve para *${accion}* el grupo.`
  });
};

handler.customPrefix = /^\.tovar/i;
handler.command = new RegExp();

export default handler;