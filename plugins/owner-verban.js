let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\n📌 Ejemplo: .wa +52 722 758 4934`);

    const number = args.join(" ").replace(/\D/g, "");
    const jid = number + "@s.whatsapp.net";

    await m.reply(`🔍 *Analizando número en WhatsApp...*`);

    let exists = false;

    try {
        const w = await conn.onWhatsApp(jid);
        exists = !!(w?.[0]?.exists);
    } catch {}

    if (exists) {
        return m.reply(
`📱 Número: https://wa.me/${number}

🟢 *ESTÁ ACTUALMENTE REGISTRADO EN WHATSAPP*`
        );
    }

    return m.reply(
`📱 Número: https://wa.me/${number}

❌ *NO ESTÁ REGISTRADO ACTUALMENTE EN WHATSAPP*`
    );
};

handler.command = /^wa$/i;
export default handler;