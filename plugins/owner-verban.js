let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\n📌 Ejemplo: .wa +52 722 758 4934`);

    const number = args.join(" ").replace(/\D/g, "");
    const jid = number + "@s.whatsapp.net";

    await m.reply(`🔍 *Analizando número en WhatsApp...*`);

    let exists = false;
    let assert = false;
    let raw = "";

    // ---------- EXISTE (REGISTRO HISTÓRICO) ----------
    try {
        const wa = await conn.onWhatsApp(jid);
        exists = !!(wa?.[0]?.exists);
    } catch (e) {}

    // ---------- ASSERT (VALIDACIÓN REAL DEL ESTADO ACTUAL) ----------
    try {
        await conn.assertJidExists(jid);
        assert = true;
    } catch (e) {
        raw = e?.message || "";
    }

    // =========================
    // 🚫 SOPORTE (TEMPORAL/PERMANENTE)
    // =========================
    if (exists && !assert) {
        return m.reply(
`📱 Número: https://wa.me/${number}

❌ *ESTADO: ESTE NÚMERO ESTÁ EN SOPORTE DE WHATSAPP*
WhatsApp lo muestra como:

*"Este número ya no está registrado"*

Esto ocurre cuando:
- Está en revisión temporal
- Está en revisión permanente
- Está bajo proceso de soporte interno

🧪 Indicadores:
▪ Registro histórico (exists): *${exists}*
▪ Registro actual (assert): *${assert}*`
        );
    }

    // =========================
    // 🚫 NO EXISTE NI REGISTRADO NI HISTÓRICO
    // =========================
    if (!exists && !assert) {
        return m.reply(
`📱 Número: https://wa.me/${number}

❌ *NO ESTÁ REGISTRADO EN WHATSAPP*`
        );
    }

    // =========================
    // 🟢 ACTIVO
    // =========================
    return m.reply(
`📱 Número: https://wa.me/${number}

🟢 *ESTADO: ACTIVO*
Este número está correctamente registrado y operativo.`
    );
};

handler.command = /^wa$/i;
export default handler;