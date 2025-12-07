let handler = async (m, { conn, args }) => {
  if (!args[0]) return m.reply(`⚠️ Ingresa un número.\nEjemplo: .wa 522233445566`);

  let number = args.join("").replace(/\D/g, "");
  let full = number + "@s.whatsapp.net";

  m.reply("⏳ *Consultando servidores de WhatsApp...*");

  try {
    // Consulta REAL del estado de cuenta al servidor de WhatsApp
    const res = await conn.query({
      tag: "iq",
      attrs: {
        to: "s.whatsapp.net",
        type: "get",
        xmlns: "urn:xmpp:whatsapp:account"
      },
      content: [{ tag: "status", attrs: {}, content: [] }]
    });

    let node = res?.content?.[0];
    let state = node?.attrs?.type || "active"; 
    let reason = node?.attrs?.reason || "none";

    // Si está baneado (temporal, permanente, spam, restricción, etc.)
    if (state !== "active" || reason !== "none") {
      return m.reply(`🔴 *BANEADO DE WHATSAPP*`);
    }

    // Si está activo
    return m.reply(`🟢 *ACTIVO ACTUALMENTE*`);

  } catch (e) {
    console.log("STATUS ERROR:", e);
    return m.reply("❌ Error consultando WhatsApp, puede estar rate-limited.");
  }
};

handler.command = /^wa$/i;
export default handler;