const handler = async (m, { conn, isAdmin, groupMetadata }) => {
  try {

    if (isAdmin) {
      return conn.sendMessage(
        m.chat,
        { text: '*𝖸𝖺 𝖤𝗋𝖾𝗌 𝖠𝖽𝗆𝗂𝗇 𝖩𝖾𝖿𝖾*', ...global.rcanal },
        { quoted: m }
      );
    }

    await conn.sendMessage(m.chat, { react: { text: '⚙️', key: m.key } });

    await conn.groupParticipantsUpdate(m.chat, [m.sender], 'promote');

    await conn.sendMessage(m.chat, { react: { text: '⭐', key: m.key } });

    return conn.sendMessage(
      m.chat,
      { text: '*𝖠𝗁𝗈𝗋𝖺 𝖤𝗋𝖾𝗌 𝖠𝖽𝗆𝗂𝗇 𝖩𝖾𝖿𝖾*', ...global.rcanal },
      { quoted: m }
    );

  } catch (e) {

    await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });

    return conn.sendMessage(
      m.chat,
      { text: '*𝖣𝖾𝗆𝖺𝗌𝗂𝖺𝖽𝗈 𝖡𝗎𝖾𝗇𝗈 𝖯𝖺𝗋𝖺 𝖲𝖾𝗋 𝖵𝖾𝗋𝖽𝖺𝖽, 𝖭𝗈 𝖯𝗎𝖾𝖽𝗈 𝖣𝖺𝗋𝗍𝖾 𝖠𝖽𝗆𝗂𝗇*', ...global.rcanal },
      { quoted: m }
    );
  }
};


handler.help = ['𝖠𝗎𝗍𝗈𝖺𝖽𝗆𝗂𝗇']
handler.tags = ['𝖮𝖶𝖭𝖤𝖱']
handler.command = ['autoadmin'];
handler.rowner = true;
handler.group = true;
export default handler;