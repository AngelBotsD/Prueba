let handler = async (m, { conn }) => {

  // === OBTENER STICKER DESDE CUALQUIER TIPO DE MENSAJE ===
  const sticker =
    m?.message?.stickerMessage ||
    m?.message?.imageMessage?.stickerMessage ||
    m?.message?.documentWithCaptionMessage?.message?.stickerMessage ||
    m?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage

  if (!sticker) return

  // === EXTRAER SHA256 REAL ===
  const sha = sticker.fileSha256
  if (!sha) {
    console.log("No trae fileSha256")
    return
  }

  const shaKey = Array.from(sha).join(",")

  console.log("🔥 STICKER DETECTADO →", shaKey)

  // === ACCIONES DIRECTAS SIN JSON ===
  const ACCIONES = {
    "3,74,169,113,129,224,130,216,68,22,163,31,155,2,77,54,200,19,222,61,146,168,204,106,77,248,131,213,117,146,94,54":
      "cerrargrupo",

    // agrega más:
    // "SHA256": "abrirgrupo"
  }

  const accion = ACCIONES[shaKey]
  if (!accion) {
    console.log("Sticker detectado pero no vinculado.")
    return
  }

  // === EJECUTAR ACCIÓN ===

  if (accion === "abrirgrupo") {
    await conn.groupSettingUpdate(m.chat, "not_announcement")
  }

  if (accion === "cerrargrupo") {
    await conn.groupSettingUpdate(m.chat, "announcement")
  }

  await conn.sendMessage(m.chat, {
    react: { text: "✅", key: m.key }
  })
}

handler.customPrefix = /.*/
handler.command = new RegExp()
handler.group = true

export default handler