let handler = async (m, { conn, text, command }) => {
  let id = text ? text : m.chat
  let mensaje = '𝖥𝗎𝖾 𝖴𝗇 𝖦𝗎𝗌𝗍𝗈 𝖤𝗌𝗍𝖺𝗋 𝖠𝗊𝗎𝗂, *𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍* 𝖲𝖾 𝖣𝖾𝗌𝗉𝗂𝖽𝖾'

  await conn.sendMessage(
    m.chat,
    { text: mensaje, mentions: [m.sender], ...global.rcanal },
    { quoted: m }
  )

  await conn.groupLeave(id)
}

handler.help = ['𝖲𝖺𝗅𝗂𝗋']
handler.tags = ['𝖮𝖶𝖭𝖤𝖱']
handler.command = /^(salir)$/i
handler.group = true
handler.owner = true
export default handler