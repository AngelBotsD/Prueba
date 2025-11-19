import { parsePhoneNumberFromString } from "libphonenumber-js";

const handler = async (m, { conn }) => {
  if (!m.isGroup) return m.reply("❌ Este comando solo funciona en grupos.");

  const group = await conn.groupMetadata(m.chat);
  const participants = group.participants || [];

  // --- MAPA DE BANDERAS POR PAÍS ---
  const flagMap = {
    MX: "🇲🇽",
    AR: "🇦🇷",
    CO: "🇨🇴",
    CL: "🇨🇱",
    PE: "🇵🇪",
    VE: "🇻🇪",
    PA: "🇵🇦",
    UY: "🇺🇾",
    PY: "🇵🇾",
    BO: "🇧🇴",
    EC: "🇪🇨",
    GT: "🇬🇹",
    SV: "🇸🇻",
    HN: "🇭🇳",
    NI: "🇳🇮",
    CR: "🇨🇷",
    DO: "🇩🇴",
    PR: "🇵🇷",
    BR: "🇧🇷",
    US: "🇺🇸",
    ES: "🇪🇸",

    // Fallback
    UNK: "🏳️"
  };

  function getFlagFromJid(jid) {
    const number = jid.split("@")[0];

    try {
      const parsed = parsePhoneNumberFromString("+" + number);
      if (!parsed) return flagMap.UNK;

      const iso = parsed.country || "UNK";
      return flagMap[iso] || flagMap.UNK;
    } catch {
      return flagMap.UNK;
    }
  }

  // Construcción del mensaje
  let texto = `📢 *MENCIÓN MASIVA*\n`;
  texto += `📅 ${new Date().toLocaleString("es-MX")}\n\n`;

  const mentions = [];

  for (const p of participants) {
    const jid = p.id;
    const flag = getFlagFromJid(jid);
    const tag = "@" + jid.split("@")[0];

    mentions.push(jid);
    texto += `${flag} ${tag}\n`;
  }

  // Enviar mensaje
  await conn.sendMessage(
    m.chat,
    {
      text: texto,
      mentions
    },
    { quoted: m }
  );
};

handler.command = ["todos"];
export default handler;