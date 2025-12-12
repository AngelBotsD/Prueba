const handler = async (m, { conn, text }) => {
  if (!text && m.quoted?.text) text = m.quoted.text;

  if (!text) {
    return conn.sendMessage(
      m.chat,
      {
        text: "𝖠𝗀𝗋𝖾𝗀𝖺 𝖳𝖾𝗑𝗍𝗈 𝖮 𝖱𝖾𝗌𝗉𝗈𝗇𝖽𝖾 𝖠 𝖴𝗇 𝖬𝖾𝗇𝗌𝖺𝗃𝖾 𝖯𝖺𝗋𝖺 𝖢𝗋𝖾𝖺𝗋 𝖤𝗅 𝖲𝗍𝗂𝖼𝗄𝖾𝗋 𝖡𝗋𝖺𝗍",
        ...global.rcanal
      },
      { quoted: m }
    );
  }

  try {
    await conn.sendMessage(m.chat, { react: { text: "🕒", key: m.key } });

        const url = `https://api.siputzx.my.id/api/m/brat?text=${encodeURIComponent(text)}`

    await conn.sendMessage(
      m.chat,
      {
        sticker: { url },
        packname: "",
        author: "",
        ...global.rcanal
      },
      { quoted: m }
    );

    await conn.sendMessage(m.chat, { react: { text: "✅", key: m.key } });

  } catch (e) {
    console.error(e);
    await conn.sendMessage(m.chat, { react: { text: "❌", key: m.key } });

    return conn.sendMessage(
      m.chat,
      {
        text: "𝖮𝖼𝗎𝗋𝗋𝗂𝗈 𝖴𝗇 𝖤𝗋𝗋𝗈𝗋 𝖠𝗅 𝖦𝖾𝗇𝖾𝗋𝖺𝗋 𝖤𝗅 𝖲𝗍𝗂𝖼𝗄𝖾𝗋",
        ...global.rcanal
      },
      { quoted: m }
    );
  }
};

handler.help = ["𝖡𝗋𝖺𝗍 <𝖳𝖾𝗑𝗍𝗈>"]
handler.tags = ["𝖲𝖳𝖨𝖢𝖪𝖤𝖱𝖲"]
handler.command = /^brat$/i;
export default handler;