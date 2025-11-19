import { parsePhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js";

const handler = async (m, { conn }) => {

  if (!m.isGroup) return m.reply("❌ Este comando solo funciona en grupos.");

  const group = await conn.groupMetadata(m.chat);
  const participants = group.participants || [];

  const flags = {
    MX: "🇲🇽", CO: "🇨🇴", AR: "🇦🇷", PE: "🇵🇪",
    CL: "🇨🇱", VE: "🇻🇪", US: "🇺🇸", BR: "🇧🇷",
    EC: "🇪🇨", GT: "🇬🇹", SV: "🇸🇻", HN: "🇭🇳",
    NI: "🇳🇮", CR: "🇨🇷", PA: "🇵🇦", UY: "🇺🇾",
    PY: "🇵🇾", BO: "🇧🇴", DO: "🇩🇴", PR: "🇵🇷",
    ES: "🇪🇸", UNK: "🏳️"
  };

  // 🔥 FUNCIÓN QUE SÍ DETECTA EL PAÍS CORRECTAMENTE
  function getFlag(jid) {
    let num = jid.split("@")[0];

    // Asegurar que empiece con +
    if (!num.startsWith("+")) num = "+" + num;

    try {
      // Intento 1: parseo directo
      let parsed = parsePhoneNumber(num);
      if (parsed?.country) return flags[parsed.country] || flags.UNK;

      // Intento 2: intentar con México por default (Meta lo usa mucho)
      parsed = parsePhoneNumber(num, "MX");
      if (parsed?.country) return flags[parsed.country] || flags.UNK;

      return flags.UNK;
    } catch {
      return flags.UNK;
    }
  }

  let texto = `📢 *MENCIÓN GLOBAL*\n\n`;
  const mentions = [];

  for (let p of participants) {
    const jid = p.id;
    const flag = getFlag(jid);
    const tag = "@" + jid.split("@")[0];

    mentions.push(jid);
    texto += `${flag} ${tag}\n`;
  }

  await conn.sendMessage(m.chat, { text: texto, mentions }, { quoted: m });
};

handler.command = ["todos"];
export default handler;