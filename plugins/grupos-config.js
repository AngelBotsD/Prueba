let handler = async (m, { conn }) => {
  // === MAPEADO DIRECTO SIN JSON ===
  const ACCIONES = {
    // Tu sticker:
    "3,74,169,113,129,224,130,216,68,22,163,31,155,2,77,54,200,19,222,61,146,168,204,106,77,248,131,213,117,146,94,54": "cerrargrupo",

    // Aquí puedes agregar más:
    // "SHA256": "abrirgrupo"
  }

  // Detectar si el mensaje es un sticker
  const stickerMsg =
    m.message?.stickerMessage ||
    m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage

  if (!stickerMsg) return

  // Obtener fileSha256 EXACTAMENTE como DS6 lo entrega
  const rawSha = stickerMsg.fileSha256
  if (!rawSha) return

  const shaKey = Array.from(rawSha).join(",")

  // Validar si este sticker está registrado en ACCIONES
  const accion = ACCIONES[shaKey]
  if (!accion) return // Sticker no vinculado → no hace nada

  // === EJECUTAR ACCIÓN ===
  if (accion === "abrirgrupo") {
    await conn.groupSettingUpdate(m.chat, "not_announcement")
  }

  if (accion === "cerrargrupo") {
    await conn.groupSettingUpdate(m.chat, "announcement")
  }

  // Confirmación
  await conn.sendMessage(m.chat, {
    react: { text: "✅", key: m.key }
  })
}

handler.customPrefix = /.*/  // Para que procese todos los mensajes
handler.command = new RegExp()
handler.group = true

export default handler