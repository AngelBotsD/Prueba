let handler = async (m, { conn, args }) => {
  if (!args[0]) return m.reply(`⚠️ Ingresa un número.\nEjemplo: .wa 522233445566`);

  let number = args.join("").replace(/\D/g, "");
  let full = number + "@s.whatsapp.net";

  await m.reply("⏳ *Consultando servidores de WhatsApp...*");

  try {
    // Intento real: WhatsApp devuelve error si el número está baneado o no existe
    await conn.assertJidExists(full);

    // Si no hubo error, existe y no está baneado
    return m.reply(`🟢 *ACTIVO ACTUALMENTE*`);

  } catch (e) {
    // Si WhatsApp rechaza la consulta → baneado, eliminado o inexistente
    return m.reply(`🔴 *BANEADO DE WHATSAPP*`);
  }
};

handler.command = /^wa$/i;
export default handler;