const handler = async (m, { conn }) => {
  const target = (m.mentionedJid && m.mentionedJid.length)
    ? m.mentionedJid[0]
    : m.quoted?.sender;

  if (!target) {
    const aviso = '*🗡️ 𝙼𝚎𝚗𝚌𝚒𝚘𝚗𝚊 𝚘 𝚛𝚎𝚜𝚙𝚘𝚗𝚍𝚎 𝙰𝚕 𝚞𝚜𝚞𝚊𝚛𝚒𝚘 𝚚𝚞𝚎 𝙳𝚎𝚜𝚎𝚊𝚜 𝙴𝚕𝚒𝚖𝚒𝚗𝚊𝚛*';
    await conn.sendMessage(m.chat, { text: aviso }, { quoted: m });
    return;
  }

  try {
    await conn.groupParticipantsUpdate(m.chat, [target], 'remove');
    await conn.sendMessage(m.chat, { text: '*🗡️ 𝚄𝚂𝚄𝙰𝚁𝙸𝙾 𝙴𝙻𝙸𝙼𝙸𝙽𝙰𝙳𝙾*' }, { quoted: m });
  } catch {
    return global.dfail('botAdmin', m, conn);
  }
};

handler.help = ["𝖪𝗂𝖼𝗄"]
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"]
handler.customPrefix = /^(?:\.?kick)(?:\s+|$)/i;
handler.command = new RegExp();
handler.group = true;
handler.admin = true
export default handler;