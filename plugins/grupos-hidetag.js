let handler = async (m, { conn }) => {
  try {
    if (!m.isGroup)
      return conn.reply(m.chat, '⚠️ Este comando solo funciona en grupos.', m);

    let text =
      m.text ||
      m.msg?.caption ||
      m.message?.imageMessage?.caption ||
      m.message?.videoMessage?.caption ||
      '';

    const newCaption = 'Notificación'; // ← texto fijo al reenviar

    // Si el mensaje está citado, reenviar el citado
    if (m.quoted) {
      const quoted = m.quoted?.message
        ? { key: m.quoted.key, message: m.quoted.message }
        : m.quoted.fakeObj || m.quoted;

      await conn.sendMessage(m.chat, { forward: quoted }, { quoted: m });
      return;
    }

    // Si tiene texto en el caption o mensaje
    if (text) {
      // Quita el .n o n del caption
      text = text.replace(/^(\.n|n)\s*/i, '').trim();

      // Si el mensaje era imagen o video, reenviar como tal con caption fijo
      if (m.message?.imageMessage || m.message?.videoMessage || m.msg?.mimetype) {
        await conn.sendMessage(
          m.chat,
          {
            forward: m,
            caption: newCaption
          },
          { quoted: m }
        );
        return;
      }

      // Si solo era texto
      await conn.sendMessage(m.chat, { text: newCaption }, { quoted: m });
      return;
    }

    await conn.reply(m.chat, '❌ No hay nada para reenviar.', m);
  } catch (err) {
    console.error(err);
    await conn.reply(m.chat, '⚠️ Error al reenviar: ' + err.message, m);
  }
};

handler.customPrefix = /^(\.n|n)(\s|$)/i;
handler.command = new RegExp();
handler.group = true;
export default handler;