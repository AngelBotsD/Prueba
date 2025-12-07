let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n👉 Ejemplo: .verban 5522113344`);

    let num = args[0].replace(/\D/g, "") + "@s.whatsapp.net";

    await m.reply("⏳ *Consultando servidores de WhatsApp...*");

    try {
        let data = await conn.onWhatsApp(num);

        if (!data || data.length === 0) {
            return m.reply("🚫 *Baneado de WhatsApp*\nEse número no está registrado.");
        }

        return m.reply("🟢 *Activo actualmente*");
        
    } catch (e) {
        return m.reply("⚠️ *Error consultando WhatsApp*\nPuede ser que el número esté caído o WhatsApp no respondió.");
    }
}

handler.command = /^wa$/i;
export default handler;