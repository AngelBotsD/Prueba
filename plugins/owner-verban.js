let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\n📌 Ejemplo: .wa +52 722 758 4934`);

    // 🧹 Limpieza robusta del número
    const number = args.join(" ").replace(/\D/g, "");
    const jid = number + "@s.whatsapp.net";

    await m.reply(`🔍 *Analizando número en WhatsApp...*`);

    let exists = false;
    let active = false;

    // 🔎 Validación REAL usando onWhatsApp()
    try {
        const info = await conn.onWhatsApp(number);
        exists = info?.[0]?.exists || false;
    } catch {}

    // 🧠 EXTRA: Verificación adicional usando fetchStatus
    // Esto detecta números que existen pero están semibloqueados o sin foto
    if (!active) {
        try {
            await conn.fetchStatus(jid);
            active = true;
        } catch {}
    }

    // ------------------------------------------------------------------
    // 🔥 Lógica de decisión mucho más sólida
    // ------------------------------------------------------------------

    if (exists || active) {
        return m.reply(
`📱 Número: https://wa.me/${number}

🟢 *REGISTRADO EN WHATSAPP*
📌 *El número responde correctamente a las señales del servidor.*
        `);
    }

    return m.reply(
`📱 Número: https://wa.me/${number}

❌ *NO REGISTRADO EN WHATSAPP*
📌 *No responde a ninguna de las validaciones oficiales.*`
    );
};

handler.command = /^wa$/i;
export default handler;