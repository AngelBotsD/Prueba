let handler = async (m, { conn, text }) => {
  if (!text) 
    return conn.sendMessage(
      m.chat,
      { text: `*𝖰𝗎𝖾 𝖭𝗈𝗆𝖻𝗋𝖾 𝖣𝖾𝗌𝖾𝖺𝗌 𝖯𝗈𝗇𝖾𝗋𝗆𝖾*`, ...global.rcanal },
      { quoted: m }
    )

  try {
    await conn.sendMessage(m.chat, { react: { text: '✏️', key: m.key } })

    await conn.updateProfileName(text)

    return conn.sendMessage(
      m.chat,
      { text: '*𝖭𝗈𝗆𝖻𝗋𝖾 𝖢𝖺𝗆𝖻𝗂𝖺𝖽𝗈 𝖤𝗑𝗂𝗍𝗈𝗌𝖺𝗆𝖾𝗇𝗍𝖾*', ...global.rcanal },
      { quoted: m }
    )

  } catch (e) {
    console.log(e)

    await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } })

    return conn.sendMessage(
      m.chat,
      { text: '*𝖠𝗁 𝖮𝖼𝗎𝗋𝗋𝗂𝖽𝗈 𝖴𝗇 𝖤𝗋𝗋𝗈𝗋 𝖨𝗇𝖾𝗌𝗉𝖾𝗋𝖺𝖽𝗈*', ...global.rcanal },
      { quoted: m }
    )
  }
}

handler.help = ['𝖲𝖾𝗍𝗇𝖺𝗆𝖾𝖻𝗈𝗍 <𝖳𝖾𝗑𝗍𝗈>']
handler.tags = ['𝖮𝖶𝖭𝖤𝖱']
handler.command = /^(nombrebot|setnamebot|cambianombre)$/i
handler.owner = true
export default handler