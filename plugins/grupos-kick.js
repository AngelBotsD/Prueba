const handler = async (m, { conn }) => {
  // Juntar todos los posibles objetivos
  let targets = [
    ...(m.mentionedJid || []),
    ...(m.quoted?.sender ? [m.quoted.sender] : [])
  ];

  // Quitar duplicados
  targets = [...new Set(targets)];

  if (!targets.length) {
    return conn.sendMessage(
      m.chat,
      { text: '⚠️ Menciona o responde a quien quieres eliminar.' },
      { quoted: m }
    );
  }

  try {
    // Expulsar TODOS al mismo tiempo = máximo rendimiento
    await Promise.all(
      targets.map(user =>
        conn.groupParticipantsUpdate(m.chat, [user], 'remove')
      )
    );

    await conn.sendMessage(
      m.chat,
      { text: `✅ Eliminados: *${targets.length}* usuario(s)` },
      { quoted: m }
    );

  } catch (err) {
    console.error(err);
    return global.dfail('botAdmin', m, conn);
  }
};

handler.customPrefix = /^(?:\.?kick)(?:\s+|$)/i;
handler.command = new RegExp();
handler.group = true;
handler.admin = true;

export default handler;