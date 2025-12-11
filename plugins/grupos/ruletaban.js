let handler = async (m, { conn, participants, isBotAdmin }) => {
  if (!m.isGroup) return conn.reply(m.chat, 'Este comando solo funciona en grupos.', m);

  let botId = (conn.user.id || conn.user.jid || "").split(':')[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';

  let candidates = participants
    .filter(p => {
      let pid = p.id.split(':')[0];
      return pid !== botId && p.admin !== 'superadmin';
    })
    .map(p => p.id);

  if (!candidates.length) return conn.reply(m.chat, 'No hay candidatos válidos para elegir.', m);

  let chosen = candidates[Math.floor(Math.random() * candidates.length)];
  let text = `Adiós putita, fuiste elegido @${chosen.split('@')[0]}`;

  await conn.sendMessage(m.chat, { text, mentions: [chosen] }, { quoted: m });

  try {
    await conn.groupParticipantsUpdate(m.chat, [chosen], 'remove');
  } catch (e) {
    return conn.reply(m.chat, 'No pude sacar al usuario (quizás hubo un error).', m);
  }
};


handler.help = ["𝖱𝗎𝗅𝖾𝗍𝖺𝖻𝖺𝗇"];
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"];
handler.command = ['ruletaban'];
handler.group = true;
handler.admin = true;
export default handler;