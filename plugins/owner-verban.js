let handler = async (m, { conn, args }) => {
  if (!args[0]) return m.reply(`⚠️ Ingresa un número.\nEjemplo: .wa 522233445566`);

  let number = args.join("").replace(/\D/g, "");
  let full = number + "@s.whatsapp.net";

  m.reply("⏳ *Consultando servidores de WhatsApp (DS6 META)...*");

  try {

    const res = await conn.queryBlocklistStatus(full);

    const state = res?.status || "unknown";

    if (state === "active") {
      return m.reply("🟢 *ACTIVO ACTUALMENTE*");
    }

    if (state === "temporary") {
      return m.reply("🟠 *BLOQUEO TEMPORAL DE WHATSAPP*");
    }

    if (state === "banned") {
      return m.reply("🔴 *BANEADO PERMANENTEMENTE DE WHATSAPP*");
    }

    if (state === "invalid") {
      return m.reply("❌ *NÚMERO NO REGISTRADO EN WHATSAPP*");
    }

    return m.reply(`⚠️ Estado desconocido: ${state}`);

  } catch (e) {
    console.log("ERROR:", e);
    return m.reply("❌ No se pudo consultar el estado. WhatsApp puede estar limitando.");
  }
};

handler.command = /^wa$/i;
export default handler;