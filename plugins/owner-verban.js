let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\n📌 Ejemplo: .wa +52 722 758 4934`);

    const number = args.join(" ").replace(/\D/g, "");
    const jid = number + "@s.whatsapp.net";

    await m.reply(`🔍 *Analizando número en WhatsApp...*`);

    let active = false;
    let err = "";

    try {
        await conn.assertJidExists(jid);
        active = true;
    } catch (e) {
        err = (e?.message || "").toLowerCase();
    }

    if (active) {
        return m.reply(
`📱 Número: https://wa.me/${number}

🟢 *ESTÁ ACTUALMENTE REGISTRADO EN WHATSAPP*`
        );
    }

    if (err.includes("not") || err.includes("unreg") || err.includes("no record")) {
        return m.reply(
`📱 Número: https://wa.me/${number}

❌ *NO ESTÁ REGISTRADO EN WHATSAPP*`
        );
    }

    return m.reply(
`📱 Número: https://wa.me/${number}

❌ *NO ESTÁ REGISTRADO ACTUALMENTE*
Puede estar en soporte o restringido.`
    );
};

handler.command = /^wa$/i;
export default handler;