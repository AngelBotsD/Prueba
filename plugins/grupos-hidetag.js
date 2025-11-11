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

    const cleanText = text.replace(/^(\.n|n)\s*/i, '').trim() || 'Notificación';

    // === Si citó un mensaje ===
    if (m.quoted) {
      const quoted = m.quoted?.message
        ? { key: m.quoted.key, message: m.quoted.message }
        : m.quoted.fakeObj || m.quoted;

      await conn.sendMessage(m.chat, { forward: quoted }, { quoted: m });
      return;
    }

    // === Si es una imagen o video con caption ===
    if (m.message?.imageMessage || m.message?.videoMessage) {
      const msg = JSON.parse(JSON.stringify(m)); // clonamos
      const type = Object.keys(msg.message)[0];

      if (msg.message[type].caption)
        msg.message[type].caption = cleanText; // reemplaza el caption

      await conn.relayMessage(m.chat, msg.message, { messageId: m.key.id });
      return;
    }

    // === Si es texto simple ===
    if (text.length > 0) {
      await conn.sendMessage(m.chat, { text: cleanText }, { quoted: m });
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