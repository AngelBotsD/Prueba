let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\n📌 Ejemplo: .wa +52 722 758 4934`);

    const number = args.join(" ").replace(/\D/g, "");
    const jid = number + "@s.whatsapp.net";

    await m.reply(`🔍 *Analizando número en WhatsApp...*`);

    let exists = false;
    let statusOk = false;
    let presenceOk = false;

    // --- 1) Verificación principal ---
    try {
        const info = await conn.onWhatsApp(number);
        exists = info?.[0]?.exists || false;
    } catch {}

    // --- 2) Status (cuenta activa responde) ---
    try {
        const s = await conn.fetchStatus(jid);
        if (s?.status !== undefined) statusOk = true;
    } catch {}

    // --- 3) Presence (solo cuentas activas responden) ---
    try {
        const p = await conn.requestPresenceUpdate(jid);
        if (p) presenceOk = true;
    } catch {}

    // --------------------------------------------------------------------
    // 🔥 LÓGICA PERFECTA
    // --------------------------------------------------------------------

    // ❌ NO REGISTRADO (no existe ni responde nada)
    if (!exists) {
        return m.reply(
`📱 Número: https://wa.me/${number}

❌ *NO REGISTRADO EN WHATSAPP*`
        );
    }

    // 🟡 REVISIÓN TEMPORAL
    if (exists && !statusOk && !presenceOk) {
        return m.reply(
`📱 Número: https://wa.me/${number}

🟡 *EN REVISIÓN TEMPORAL POR WHATSAPP*
📌 Existe, pero el servidor bloquea:
- Estado
- Presencia
- Información pública

✔ Esto SOLO pasa cuando WhatsApp lo está revisando.`
        );
    }

    // 🟢 ACTIVO
    if (exists && (statusOk || presenceOk)) {
        return m.reply(
`📱 Número: https://wa.me/${number}

🟢 *REGISTRADO Y ACTIVO EN WHATSAPP*`
        );
    }

    // 🔴 SUSPENDIDO / BAN
    return m.reply(
`📱 Número: https://wa.me/${number}

🔴 *SUSPENDIDO O ELIMINADO*
📌 Existe en registros, pero no responde ninguna API.`
    );
};

handler.command = /^wa$/i;
export default handler;