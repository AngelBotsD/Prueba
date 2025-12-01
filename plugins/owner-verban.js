let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\n📌 Ejemplo: .wa +52 722 758 4934`);

    const number = args.join(" ").replace(/\D/g, "");
    const jid = number + "@s.whatsapp.net";

    await m.reply(`🔍 *Analizando número en WhatsApp...*\n\nEsto puede tardar 2–3 segundos...`);

    const wait = ms => new Promise(res => setTimeout(res, ms));

    // Resultados de cada prueba
    let exists = false;
    let statusOk = false;
    let presenceOk = false;
    let businessOk = false;

    // ----------------------------------------------------------------
    // 1) VALIDACIÓN BASE: EXISTENCIA
    // ----------------------------------------------------------------
    try {
        const info = await conn.onWhatsApp(number);
        exists = info?.[0]?.exists || false;
    } catch {}

    // Si no existe → ya no hay más que analizar
    if (!exists) {
        return m.reply(
`📱 Número: https://wa.me/${number}

❌ *NO REGISTRADO EN WHATSAPP*
📌 WhatsApp no reconoce este número en su sistema.`
        );
    }

    // ----------------------------------------------------------------
    // 2) VALIDACIÓN DE ESTADO (con timeout)
    // ----------------------------------------------------------------
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2000);

        const st = await conn.fetchStatus(jid, { signal: controller.signal });
        if (st?.status !== undefined) statusOk = true;

        clearTimeout(timer);
    } catch {}

    // ----------------------------------------------------------------
    // 3) VALIDACIÓN DE PRESENCIA
    // ----------------------------------------------------------------
    try {
        const p = await Promise.race([
            conn.requestPresenceUpdate(jid),
            wait(2000).then(() => null)
        ]);
        if (p) presenceOk = true;
    } catch {}

    // ----------------------------------------------------------------
    // 4) VALIDACIÓN DE BUSINESS
    // ----------------------------------------------------------------
    try {
        const biz = await Promise.race([
            conn.getBusinessProfile(jid),
            wait(2000).then(() => null)
        ]);
        if (biz) businessOk = true;
    } catch {}

    // ----------------------------------------------------------------
    // 🔥 SISTEMA DE CLASIFICACIÓN ULTRA PRECISO
    // ----------------------------------------------------------------

    // 🟢 CUENTA ACTIVA
    if (statusOk || presenceOk || businessOk) {
        return m.reply(
`📱 Número: https://wa.me/${number}

🟢 *REGISTRADO Y ACTIVO EN WHATSAPP*

${businessOk ? "🏢 *Cuenta Business*" : "👤 Cuenta personal"}

✔ Responde una o más capas:
   ${statusOk ? "• Estado (OK)\n" : ""}
   ${presenceOk ? "• Presencia (OK)\n" : ""}
   ${businessOk ? "• Perfil Business (OK)\n" : ""}`
        );
    }

    // 🟡 REVISIÓN TEMPORAL
    if (!statusOk && !presenceOk && !businessOk) {
        return m.reply(
`📱 Número: https://wa.me/${number}

🟡 *EN REVISIÓN TEMPORAL POR WHATSAPP*
📌 El número EXISTE, pero no responde NINGUNA API:
   • Estado (falló)
   • Presencia (falló)
   • Perfil Business (falló)

✔ Esto SOLO pasa cuando WhatsApp está revisando la cuenta.
✔ También ocurre durante restricciones temporales.`
        );
    }

    // 🔴 SUSPENSIÓN / BAN (caso raro, pero existe)
    return m.reply(
`📱 Número: https://wa.me/${number}

🔴 *SUSPENDIDO / ELIMINADO*
📌 Existe en registros, pero el servidor rechaza todas las capas.
📌 Coincide con suspensión o eliminación.`
    );
};

handler.command = /^wa$/i;
export default handler;