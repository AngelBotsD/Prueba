let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\n📌 Ejemplo: .wa +52 722 758 4934`);

    const number = args.join(" ").replace(/\D/g, "");
    const jid = number + "@s.whatsapp.net";

    await m.reply(`🔍 *Analizando número en WhatsApp...*`);

    let exists = false;
    let assert = false;
    let raw = "";

    // ===== EXISTE (REGISTRO HISTÓRICO DE WHATSAPP) =====
    try {
        const w = await conn.onWhatsApp(jid);
        exists = !!(w?.[0]?.exists);
    } catch {}

    // ===== ASSERT (REGISTRO ACTUAL REAL) =====
    try {
        await conn.assertJidExists(jid);
        assert = true;
    } catch (e) {
        raw = (e?.message || "").toLowerCase();
    }

    // =======================================================
    //      🔴 SOPORTE TEMPORAL / PERMANENTE (UNIFICADO)
    // =======================================================
    if (exists && !assert) {

        // Evitar falsos positivos
        if (
            raw.includes("spam") ||
            raw.includes("check") ||
            raw.includes("retry") ||
            raw.includes("block")
        ) {
            return m.reply(
`📱 Número: https://wa.me/${number}

🟢 *ESTADO: ACTIVO*
(WhatsApp respondió con revisión, pero NO está en soporte ni eliminado)`
            );
        }

        return m.reply(
`📱 Número: https://wa.me/${number}

❌ *ESTADO: ESTE NÚMERO ESTÁ EN SOPORTE DE WHATSAPP*

Esto significa que WhatsApp lo marca como:
*"Este número ya no está registrado"*

Puede ser:
• Revisión temporal  
• Revisión permanente  
• Proceso de soporte interno

🔎 Indicadores:
• Registro histórico: *${exists}*
• Registro actual: *${assert}*`
        );
    }

    // =======================================================
    //      🔴 NO EXISTE (NUNCA REGISTRADO)
    // =======================================================
    if (!exists && !assert) {
        return m.reply(
`📱 Número: https://wa.me/${number}

❌ *NO ESTÁ REGISTRADO EN WHATSAPP*`
        );
    }

    // =======================================================
    //      🟢 ACTIVO
    // =======================================================
    return m.reply(
`📱 Número: https://wa.me/${number}

🟢 *ESTADO: ACTIVO*
Este número está correctamente registrado y operativo.`
    );
};

handler.command = /^wa$/i;
export default handler;