let handler = async (m, { conn }) => {
  const text = m.text?.trim().toLowerCase() || ""
  let action = text.match(/(abrir|cerrar|open|close)/)
  if (!action) return

  action = action[1]

  let mode, msg
  if (/abrir|open/.test(action)) {
    mode = "not_announcement"
    msg = "Grupo abierto correctamente ✅"
  } else {
    mode = "announcement"
    msg = "Grupo cerrado correctamente 🔒"
  }

  await conn.groupSettingUpdate(m.chat, mode)

  await conn.sendMessage(m.chat, {
    text: msg,
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
handler.admin = true;
export default handler