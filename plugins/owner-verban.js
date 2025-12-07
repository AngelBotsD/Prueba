let handler = async (m, { conn, args }) => {
  if (!args[0]) return m.reply(`⚠️ Ingresa un número.\nEjemplo: .wa 522233445566`);

  let number = args.join("").replace(/\D/g, "");
  let full = number + "@s.whatsapp.net";

  m.reply("⏳ *Analizando directamente con servidores oficiales de WhatsApp...*");

  try {
    // **Query REAL al endpoint de ban check**
    const res = await conn.query({
      tag: "iq",
      attrs: {
        to: "s.whatsapp.net",
        type: "get",
        xmlns: "urn:xmpp:whatsapp:account"
      },
      content: [
        { tag: "status", attrs: {}, content: [] }
      ]
    });

    let node = res?.content?.[0];

    // Si WhatsApp no responde
    if (!node) {
      return m.reply("❌ Error: WhatsApp no devolvió ningún dato.");
    }

    let ban = node?.attrs?.type || "active";
    let reason = node?.attrs?.reason || "none";
    let violation = node?.attrs?.violation_type || "0";

    // respuesta construida
    let result = {
      banned: ban !== "active",
      reason,
      details: {
        login: number,
        status: ban,
        violation_type: violation
      }
    };

    // enviar al chat formato JSON
    return m.reply("```" + JSON.stringify(result, null, 4) + "```");

  } catch (e) {
    console.log("ERROR EN STATUS CHECK:", e);
    return m.reply("❌ Error consultando WhatsApp, puede estar rate-limited.");
  }
};

handler.command = /^wa$/i;
export default handler;