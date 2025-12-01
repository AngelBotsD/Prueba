let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\n📌 Ejemplo: .wa +52 722 758 4934`);

    const number = args.join(" ").replace(/\D/g, "");
    const jid = number + "@s.whatsapp.net";

    await m.reply(`🔍 *Analizando número en WhatsApp...*`);

    let exists = false;

    try {
        const info = await conn.onWhatsApp(number);
        exists = info?.[0]?.exists || false;
    } catch {}

    if (!exists) {
        return m.reply(
`📱 Número: https://wa.me/${number}

❌ *NO REGISTRADO EN WHATSAPP*

📌 Esto incluye:
- Número no existente
- Revisión temporal
- Revisión permanente
- Suspensión o ban permanente

WhatsApp los trata a todos como “no registrados”.`
        );
    }

    return m.reply(
`📱 Número: https://wa.me/${number}

🟢 *REGISTRADO Y ACTIVO EN WHATSAPP*`
    );
};

handler.command = /^wa$/i;
export default handler;