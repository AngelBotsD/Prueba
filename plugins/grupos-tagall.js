import { parsePhoneNumber } from "libphonenumber-js";

const handler = async (m, { conn, participants, isAdmin, isOwner }) => {
  if (!m.isGroup) return;
  if (!isAdmin && !isOwner) return global.dfail?.('admin', m, conn);

  const flags = {
    MX: "🇲🇽", CO: "🇨🇴", AR: "🇦🇷", PE: "🇵🇪",
    CL: "🇨🇱", VE: "🇻🇪", US: "🇺🇸", BR: "🇧🇷",
    EC: "🇪🇨", GT: "🇬🇹", SV: "🇸🇻", HN: "🇭🇳",
    NI: "🇳🇮", CR: "🇨🇷", PA: "🇵🇦", UY: "🇺🇾",
    PY: "🇵🇾", BO: "🇧🇴", DO: "🇩🇴", PR: "🇵🇷",
    ES: "🇪🇸", UNK: "🏳️"
  };

  // Función para extraer número real o fallback a LID
  async function resolverNumero(id) {
    const esLID = id.endsWith('@lid');
    if (!esLID) return id.split("@")[0]; // número visible

    // Aquí podemos llamar a conn.onWhatsApp(id) si quieres intentar resolver el LID
    try {
      const info = await conn.onWhatsApp(id);
      if (info && info[0] && info[0].jid) return info[0].jid.split("@")[0];
    } catch {}
    return "DESCONOCIDO";
  }

  function getFlag(num) {
    if (num === "DESCONOCIDO") return "🏳️";
    try {
      const pn = parsePhoneNumber("+" + num);
      return pn?.country ? flags[pn.country] || flags.UNK : flags.UNK;
    } catch {
      return "🏳️";
    }
  }

  let texto = `📣 *MENCIÓN GLOBAL*\n\n`;
  const mentions = [];

  for (const user of participants) {
    const numero = await resolverNumero(user.id);
    const flag = getFlag(numero);
    const tag = "@" + numero;

    texto += `${flag} ${tag}\n`;
    mentions.push(user.id);
  }

  await conn.sendMessage(m.chat, { react: { text: '🔔', key: m.key } });
  await conn.sendMessage(m.chat, { text: texto, mentions }, { quoted: m });
};

handler.customPrefix = /^\.?(todos)$/i;
handler.command = new RegExp();
handler.group = true;
handler.admin = true;

export default handler;