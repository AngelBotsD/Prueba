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

    // ===== EXISTE (REGISTRO HISTÓRICO) =====
    try {
        const w = await conn.onWhatsApp(jid);
        exists = !!(w?.[0]?.exists);
    } catch {}

    // ===== FOTO DE PERFIL (INDICADOR FUERTE DE ACTIVIDAD) =====
    try {
        await conn.profilePictureUrl(jid, 'image');
        pp = true;
    } catch {}

    // ===== ESTADO / INFO =====
    try {
        await conn.fetchStatus(jid);
        status = true;
    } catch {}

    // ===== PRESENCIA =====
    try {
        await conn.presenceSubscribe(jid);
        presence = true;
    } catch {}

    // ===== ASSERT (REGISTRO ACTUAL REAL) =====
    try {
        await conn.assertJidExists(jid);
        assert = true;
    } catch (e) {
        raw = (e?.message || "").toLowerCase();
    }

    // =======================================================
    //      🔴 SOPORTE TEMPORAL / PERMANENTE
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

WhatsApp lo marca como:
*"Este número ya no está registrado"*

Puede ser:
• Revisión temporal  
• Revisión permanente  
• Proceso interno de soporte

🔎 Indicadores:
• Registro histórico: *${exists}*
• Registro actual: *${assert}*`
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
    //      🟢 ACTIVO (VALIDACIONES COMPLETAS)
    // =======================================================
    if (exists && (assert || pp || status || presence)) {
        return m.reply(
`📱 Número: https://wa.me/${number}

🟢 *ESTADO: ACTIVO*

✔ assert (registro actual): ${assert}  
✔ foto: ${pp}  
✔ estado: ${status}  
✔ presencia: ${presence}  

Este número está correctamente registrado y operativo.`
        );
    }

    // =======================================================
    //      🟡 INDETERMINADO
    // =======================================================
    return m.reply(
`📱 Número: https://wa.me/${number}

⚪ *ESTADO: INDETERMINADO*
Algunas pruebas no coinciden.`
    );
};

handler.command = /^wa$/i;
export default handler;