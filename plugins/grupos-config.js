let handler = async (m, { conn }) => {
  const text = m.text?.trim().toLowerCase() || ""
  let action = text.match(/(abrir|cerrar|open|close)/)
  if (!action) return

  action = action[1]

  let mode = /abrir|open/.test(action)
    ? "not_announcement"
    : "announcement"

  await conn.groupSettingUpdate(m.chat, mode)

  // === Sticker desde bytes ===
  const stickerBytes = [
    3,74,169,113,129,224,130,216,68,22,163,31,155,2,77,54,
    200,19,222,61,146,168,204,106,77,248,131,213,117,146,94,54
  ]

  const bufferSticker = Buffer.from(stickerBytes)

  await conn.sendMessage(m.chat, {
    sticker: bufferSticker,
    quoted: m
  })

  await conn.sendMessage(m.chat, {
    react: { text: '✅', key: m.key }
  })
}

handler.help = ["𝖦𝗋𝗎𝗉𝗈 𝖠𝖻𝗋𝗂𝗋", "𝖦𝗋𝗎𝗉𝗈 𝖢𝖾𝗋𝗋𝖺𝗋"]
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"]
handler.customPrefix = /^(?:\.?grupo\s*(abrir|cerrar|open|close)|\.?(abrir|cerrar|open|close))$/i
handler.command = new RegExp()
handler.group = true

export default handler