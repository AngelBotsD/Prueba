let linkRegex = /chat.whatsapp.com\/([0-9A-Za-z]{20,24})( [0-9]{1,3})?/i

let handler = async (m, { conn, text, isOwner, usedPrefix, command }) => {

  if (!text) return conn.sendMessage(
    m.chat,
    {
      text: `*𝖨𝗇𝗀𝗋𝖾𝗌𝖺 𝖤𝗅 𝖤𝗇𝗅𝖺𝖼𝖾 𝖣𝖾𝗅 𝖦𝗋𝗎𝗉𝗈 𝖠𝗅 𝖰𝗎𝖾 𝖬𝖾 𝖴𝗇𝗂𝗋𝖾*`,
      ...global.rcanal
    },
    { quoted: m }
  )

  try {
    let [_, code] = text.match(linkRegex) || []
    if (!code) return conn.sendMessage(
      m.chat,
      {
        text: `*𝖤𝗇𝗅𝖺𝖼𝖾 𝖨𝗇𝗏𝖺𝗅𝗂𝖽𝗈*`,
        ...global.rcanal
      },
      { quoted: m }
    )

    let res = await conn.groupAcceptInvite(code)

    return conn.sendMessage(
      m.chat,
      {
        text: `*𝖬𝖾 𝖴𝗇𝗂 𝖤𝗑𝗂𝗍𝗈𝗌𝖺𝗆𝖾𝗇𝗍𝖾 𝖠𝗅 𝖦𝗋𝗎𝗉𝗈*`,
        ...global.rcanal
      },
      { quoted: m }
    )

  } catch (e) {
    return conn.sendMessage(
      m.chat,
      {
        text: `𝖠𝗁 𝖮𝖼𝗎𝗋𝗋𝗂𝖽𝗈 𝖴𝗇 𝖤𝗋𝗋𝗈𝗋 𝖨𝗇𝖾𝗌𝗉𝖾𝗋𝖺𝖽𝗈`,
        ...global.rcanal
      },
      { quoted: m }
    )
  }
}

handler.help = ['𝖩𝗈𝗂𝗇 <𝖫𝗂𝗇𝗄>']
handler.tags = ['𝖮𝖶𝖭𝖤𝖱']
handler.command = ['join', 'entrar']
handler.rowner = true
export default handler