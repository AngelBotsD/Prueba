const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const sender = msg.sender || msg.participant || msg.key.participant;
  const body = (msg.text || "").toLowerCase();

  const abrir = /\b(abrir|open)\b/.test(body);
  const cerrar = /\b(cerrar|close)\b/.test(body);

  if (!abrir && !cerrar) {
    return conn.sendMessage(chatId, { 
      text: "❌ Debes especificar *abrir* o *cerrar* el grupo." 
    }, { quoted: msg });
  }

  // ====== ⚡ DETECCIÓN DE ADMIN REAL Y RÁPIDA ======
  let meta = await conn.groupMetadata(chatId).catch(() => null);

  const admins = meta?.participants?.filter(p => 
    p.admin === "admin" || p.admin === "superadmin"
  )?.map(p => p.id) || [];

  const isAdmin = admins.includes(sender);

  if (!isAdmin) {
    return conn.sendMessage(chatId, { 
      text: "❌ No tienes permisos de admin para hacer eso." 
    }, { quoted: msg });
  }
  // ====== FIN ADMIN ======

  try {
    await conn.sendMessage(chatId, { react: { text: abrir ? "🔓" : "🔒", key: msg.key } });
  } catch {}

  try {
    await conn.groupSettingUpdate(chatId, abrir ? "not_announcement" : "announcement");

    return conn.sendMessage(chatId, {
      text: abrir
        ? "*𝖤𝗅 𝖦𝗋𝗎𝗉𝗈 𝖧𝖺 𝖲𝗂𝖽𝗈 𝖠𝖻𝗂𝖾𝗋𝗍𝗈 𝖢𝗈𝗋𝗋𝖾𝖼𝗍𝖺𝗆𝖾𝗇𝗍𝖾* 🔓"
        : "*𝖤𝗅 𝖦𝗋𝗎𝗉𝗈 𝖧𝖺 𝖲𝗂𝖽𝗈 𝖢𝖾𝗋𝗋𝖺𝖽𝗈 𝖢𝗈𝗋𝗋𝖾𝖼𝗍𝖺𝗆𝖾𝗇𝗍𝖾* 🔒"
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
handler.admin = false; // 🔥 ya no dejamos que Baileys decida
handler.command = /^(.*)$/i;

handler.customPrefix = /^(?:\.?grupo\s*(abrir|cerrar|open|close)|\.?(abrir|cerrar|open|close)(\s+grupo)?)$/i;

export default handler;