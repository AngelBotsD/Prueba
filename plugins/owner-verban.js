let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\n📌 *Ejemplo:* .wa +52 722 758 4934`);

    const number = args.join(" ").replace(/\D/g, "");
    const jid = number + "@s.whatsapp.net";

    await m.reply(`🔍 *Analizando número actual en WhatsApp...*`);

    let existsNow = false;
    let pp = false;
    let status = false;
    let assert = false;
    let presence = false;
    let rawError = "";

    // =============================
    // 🔍 PRUEBA PRINCIPAL: REGISTRO ACTUAL
    // =============================
    try {
        const wa = await conn.onWhatsApp(jid);
        existsNow = !!(wa && wa[0] && wa[0].exists);
    } catch (e) {
        rawError = e?.message || "";
    }

    // SI NO ESTÁ REGISTRADO → MENSAJE DIRECTO
    if (!existsNow) {
        return m.reply(
`📱 Número: https://wa.me/${number}

❌ *ESTE NÚMERO YA NO ESTÁ REGISTRADO EN WHATSAPP*
No tiene un registro activo en la base de datos de WhatsApp.

🧪 Esto significa:
- Puede haber sido baneado permanentemente
- Puede haber sido reciclado por la compañía telefónica
- O simplemente jamás fue una cuenta activa`
        );
    }

    // =============================
    // 🔍 PRUEBAS ADICIONALES
    // =============================

    try {
        await conn.profilePictureUrl(jid, 'image');
        pp = true;
    } catch {}

    try {
        await conn.fetchStatus(jid);
        status = true;
    } catch {}

    try {
        await conn.assertJidExists(jid);
        assert = true;
    } catch {}

    try {
        await conn.presenceSubscribe(jid);
        presence = true;
    } catch {}

    // =============================
    // 🔥 DETECCIÓN DE BLOQUEO
    // =============================

    let temporal = false;
    let permanente = false;

    // BLOQUEO PERMANENTE (cuenta existe pero backend la rechaza)
    if (!pp && !status && !assert && presence === false) {
        permanente = true;
    }

    // BLOQUEO TEMPORAL (limitado pero aún con registro válido)
    if (!permanente && existsNow && !presence && !status) {
        temporal = true;
    }

    if (permanente) {
        return m.reply(
`📱 Número: https://wa.me/${number}

🔴 *BLOQUEO PERMANENTE DETECTADO*
El número aparece registrado, pero WhatsApp no permite consultas internas.

🧪 Indicadores:
▪ Foto: *${pp}*
▪ Status: *${status}*
▪ assertJid: *${assert}*
▪ Presencia: *${presence}*`
        );
    }

    if (temporal) {
        return m.reply(
`📱 Número: https://wa.me/${number}

🟠 *BLOQUEO TEMPORAL DETECTADO*
El número existe, pero WhatsApp limita consultas internas temporalmente.

🧪 Indicadores:
▪ Foto: *${pp}*
▪ Status: *${status}*
▪ assertJid: *${assert}*
▪ Presencia: *${presence}*`
        );
    }

    // =============================
    // 🟢 ACTIVO
    // =============================
    return m.reply(
`📱 Número: https://wa.me/${number}

🟢 *ESTADO: ACTIVO*
Este número está registrado actualmente en WhatsApp.

▪ Foto: *${pp}*
▪ Status: *${status}*
▪ assertJid: *${assert}*
▪ Presencia: *${presence}*`
    );
};

handler.command = /^wa$/i;
export default handler;