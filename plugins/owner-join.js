import fetch from 'node-fetch';

let handler = async (m, { text, conn }) => {
  // Detectar si el mensaje menciona al bot o usa comandos
  const isTagged = m.mentionedJid?.includes(conn.user.jid) || false;
  const isCommand = /^[\.]?(bot|gemini)/i.test(m.text);

  if (!isTagged && !isCommand) return;

  // Extraer la consulta (elimina menciones/comandos)
  let query = m.text
    .replace(new RegExp(`@${conn.user.jid.split('@')[0]}`, 'gi'), '') // Elimina @EliteBot
    .replace(/^[\.]?(bot|gemini)\s*/i, '') // Elimina comandos
    .trim();

  if (!query) {
    return conn.sendMessage(m.chat, { text: `¡Hola!\nMi nombre es Angel Bot\n¿En qué te puedo ayudar? ♥️` }, { quoted: m });
  }

  try {
    // Presencia de escritura
    await conn.sendPresenceUpdate('composing', m.chat);

    const apiUrl = `https://apis-starlights-team.koyeb.app/starlight/gemini?text=${encodeURIComponent(query)}`;
    const res = await fetch(apiUrl);
    const data = await res.json();

    // Enviar la respuesta al chat
    await conn.sendMessage(m.chat, { text: data.result || '🔴 La API no devolvió respuesta' }, { quoted: m });
  } catch (e) {
    console.error(e);
    await conn.sendMessage(m.chat, { text: `❌ Error al procesar tu solicitud\n${e.message || e}` }, { quoted: m });
  }
};

// Configuración universal
handler.customPrefix = /^(\.?bot|\.?gemini|@\d+)/i;
handler.command = new RegExp();
handler.tags = ['ai'];
export default handler;