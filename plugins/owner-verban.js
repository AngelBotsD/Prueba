let handler = async (m, { conn, args }) => {
  if (!args[0]) return m.reply(`⚠️ Ingresa un número.\nEjemplo: .wa 522233445566`);

  let number = args[0].replace(/\D/g, "");
  let full = number + "@s.whatsapp.net";

  m.reply("⏳ *Consultando directamente a WhatsApp...*");

  try {
    const result = await conn.onWhatsApp(full);

    if (!result || result.length === 0) {
      return m.reply(`❌ *WHATSAPP RESPONDE:*  
📵 El número no está registrado o está suspendido permanentemente.`);
    }

    const info = result[0]; // WhatsApp solo devuelve uno
    const exists = info.exists;

    if (!exists) {
      return m.reply(`❌ *WHATSAPP RESPONDE:*  
📵 Número inexistente o baneado permanente.`);
    }

    return m.reply(`🟢 *WHATSAPP RESPONDE:*  
✔️ El número *sí está activo*  
📱 JID: ${info.jid}`);
  } catch (e) {
    console.log(e);
    return m.reply("❌ Error al consultar WhatsApp. Intenta más tarde.");
  }
};

handler.help = ["wa <número>"];
handler.tags = ["tools"];
handler.command = /^wa$/i;

export default handler;