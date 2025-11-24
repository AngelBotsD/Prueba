const urlRegex = /\b((https?:\/\/|www\.)[^\s/$.?#].[^\s]*)/gi;

const allowedDomains = [
  'instagram.com',
  'www.instagram.com',
  'ig.me'
];

const shorteners = [
  'bit.ly',
  'tinyurl.com',
  't.co',
  'shorturl.at',
  'goo.gl',
  'rebrand.ly',
  'is.gd',
  'cutt.ly',
  'linktr.ee',
  'shrtco.de'
];

export async function before(m, { conn, isAdmin }) {

  // 🚫 IGNORAR MENSAJES DEL BOT PARA QUE NO SE AUTO-DETECTE
  if (m.fromMe || m.id?.startsWith(conn.user.jid) || m.isBaileys) return true;

  if (!m.isGroup) return false;

  const chat = global.db.data.chats[m.chat];
  if (!chat.antiLink) return true;

  const body = (m.text || "").trim();
  if (!body || isAdmin) return true;

  const links = body.match(urlRegex);
  if (!links) return true;

  try {
    const groupInvite = `https://chat.whatsapp.com/${await conn.groupInviteCode(m.chat)}`;
    const normalizedGroupLink = groupInvite.toLowerCase();

    for (let link of links) {
      const lower = link.toLowerCase();

      if (
        lower.includes(normalizedGroupLink) ||
        allowedDomains.some(domain => lower.includes(domain))
      ) continue;

      if (shorteners.some(s => lower.includes(s)) || !allowedDomains.some(d => lower.includes(d))) {
        try { await conn.sendMessage(m.chat, { delete: m.key }); } catch {}
        try {
          await conn.sendMessage(
            m.chat,
            {
              text: `🚫 *No se permiten links aquí*, *@${m.sender.split('@')[0]}*`,
              mentions: [m.sender]
            },
            { quoted: m }
          );
        } catch {}
        break;
      }
    }
  } catch (err) {
    console.error("Error en antiLink:", err);
  }

  return true;
}