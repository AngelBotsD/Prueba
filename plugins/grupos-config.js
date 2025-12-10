let handler = async (m, { conn, isAdmin, isBotAdmin }) => {
  const sticker = m.message?.stickerMessage;

  if (!sticker) return;

  // ID del sticker (array → buffer)
  const cerrarID = Buffer.from([
    3,74,169,113,129,224,130,216,68,22,163,31,155,2,
    77,54,200,19,222,61,146,168,204,106,77,248,131,
    213,117,146,94,54
  ]);

  // Obtener SHA del sticker recibido
  const sha = sticker.fileSha256;

  // Comparar
  if (!sha || !sha.equals(cerrarID)) return;

  // Validar permisos
  if (!isAdmin)
    return conn.sendMessage(m.chat, { text: "Solo admins pueden usar este sticker." }, { quoted: m });

  if (!isBotAdmin)
    return conn.sendMessage(m.chat, { text: "Dame admin para cerrar el grupo." }, { quoted: m });

  // Cerrar grupo
  await conn.groupSettingUpdate(m.chat, "announcement");

  // Sticker de confirmación
  await conn.sendMessage(m.chat, {
    sticker: { url: "https://cdn.russellxz.click/1f922165.webp" },
    quoted: m
  });

  // Reacción
  await conn.sendMessage(m.chat, {
    react: { text: "✅", key: m.key }
  });
};


handler.command = new RegExp(); // obligatorio
handler.customPrefix = /^$/; // no activa por texto
handler.group = true;

export default handler;