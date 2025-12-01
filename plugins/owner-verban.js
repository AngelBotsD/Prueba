let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\n📌 Ejemplo: .wa +52 722 758 4934`);

    const number = args.join(" ").replace(/\D/g, "");
    const jid = number + "@s.whatsapp.net";

    await m.reply(`🔍 *Analizando número en WhatsApp...*`);

    let exists = false;
    let assert = false;
    let pp = false;
    let status = false;
    let presence = false;
    let raw = "";

    // ===== EXISTE =====
    try {
        const w = await conn.onWhatsApp(jid);
        exists = !!(w?.[0]?.exists);
    } catch {}

    // ===== FOTO =====
    try {
        await conn.profilePictureUrl(jid, "image");
        pp = true;
    } catch {}

    // ===== STATUS =====
    try {
        await conn.fetchStatus(jid);
        status = true;
    } catch {}

    // ===== PRESENCIA =====
    try {
        await conn.presenceSubscribe(jid);
        presence = true;
    } catch {}

    // ===== ASSERT =====
    try {
        await conn.assertJidExists(jid);
        assert = true;
    } catch (e) {
        raw = (e?.message || "").toLowerCase();
    }

    // =======================================================
    //      🔴 SOPORTE (TEMPORAL + PERMANENTE)
    // =======================================================
    if (exists && !assert && !pp && !status && !presence) {
        return m.reply(
`📱 Número: https://wa.me/${number}

❌ *ESTE NÚMERO ESTÁ EN SOPORTE DE WHATSAPP*`
        );
    }

    // =======================================================
    //      🔴 NO EXISTE
    // =======================================================
    if (!exists && !assert) {
        return m.reply(
`📱 Número: https://wa.me/${number}

❌ *NO ESTÁ REGISTRADO EN WHATSAPP*`
        );
    }

    // =======================================================
    //      🟢 ACTIVO (MISMA LÓGICA QUE TU CÓDIGO ORIGINAL)
    // =======================================================
    if (exists && (pp || status || assert || presence)) {
        return m.reply(
`📱 Número: https://wa.me/${number}

🟢 *ESTADO: ACTIVO*
• Foto: ${pp}
• Status: ${status}
• assertJid: ${assert}
• Presencia: ${presence}`
        );
    }

    return m.reply(
`📱 Número: https://wa.me/${number}

⚪ *ESTADO: INDETERMINADO*`
    );
};

handler.command = /^wa$/i;
export default handler;