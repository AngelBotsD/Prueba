let handler = async (m, { conn, args }) => {
  if (!args[0]) return m.reply(`⚠️ Ingresa un número.\nEjemplo: .wa 5217227584934`);

  let number = args[0].replace(/\D/g, "");
  let jid = number + "@s.whatsapp.net";

  m.reply("⏳ Consultando servidores oficiales de WhatsApp...");

  try {
    // 1) Verificar si existe
    const exists = await conn.onWhatsApp(jid);

    if (!exists || !exists[0] || !exists[0].exists) {
      return m.reply("🔴 *BANEADO DE WHATSAPP*\nNo aparece como cuenta activa.");
    }

    // 2) Consultar estado real (ban, motivos, etc.)
    const status = await conn.queryAccountStatus(jid);

    // Si trae info de ban
    if (status?.account?.attrs?.status === "fail") {
      return m.reply(
        `🔴 *BANEADO PERMANENTE*\n` +
        `📄 Motivo: *${status.account.attrs.reason || "Desconocido"}*\n` +
        `🧩 Código: ${status.account.attrs["violation_type"] || "?"}`
      );
    }

    // Si está activo
    return m.reply("🟢 *Activo actualmente*");

  } catch (err) {
    console.log(err);
    return m.reply("❌ Error al consultar el estado en WhatsApp.");
  }
};

handler.command = /^wa$/i;
export default handler;