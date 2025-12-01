let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\n📌 Ejemplo: .wa +52 722 758 4934`);

    const number = args.join(" ").replace(/\D/g, "");
    const jid = number + "@s.whatsapp.net";

    await m.reply(`🔍 *Analizando número en WhatsApp...*`);

    let exists = false;
    let assert = false;

    try {
        const w = await conn.onWhatsApp(jid);
        exists = !!(w?.[0]?.exists);
    } catch {}

    try {
        await conn.assertJidExists(jid);
        assert = true;
    } catch {}

    if (exists && assert) {
        return m.reply(
`📱 Número: https://wa.me/${number}

🟢 *ESTADO: ACTUALMENTE REGISTRADO*`
        );
    }

    if (exists && !assert) {
        return m.reply(
`📱 Número: https://wa.me/${number}

❌ *ESTE NÚMERO ESTÁ EN SOPORTE*
Existió antes, pero actualmente no está registrado.`
        );
    }

    if (!exists && !assert) {
        return m.reply(
`📱 Número: https://wa.me/${number}

❌ *NO ESTÁ REGISTRADO EN WHATSAPP*`
        );
    }

    return m.reply(
`📱 Número: https://wa.me/${number}

⚪ *ESTADO INDETERMINADO*`
    );
};

handler.command = /^wa$/i;
export default handler;