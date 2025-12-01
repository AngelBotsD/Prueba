let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\n📌 Ejemplo: .wa +52 722 758 4934`);

    const number = args.join(" ").replace(/\D/g, "");
    const jid = number + "@s.whatsapp.net";

    await m.reply(`🔍 *Analizando número en WhatsApp...*`);

    let exists = false;
    let statusOk = false;
    let business = false;

    // --- 1) Validación base con onWhatsApp() ---
    let info = null;
    try {
        info = await conn.onWhatsApp(number);
        exists = info?.[0]?.exists || false;
    } catch {}


    // --- 2) Intentar obtener STATUS ---
    // Esto detecta:
    //  - cuenta activa
    //  - revisión temporal
    //  - suspensión
    let statusError = null;
    try {
        const s = await conn.fetchStatus(jid);
        if (s?.status !== undefined) statusOk = true;
    } catch (e) {
        statusError = e?.message || "unknown";
    }


    // --- 3) Detectar Business REAL ---
    try {
        const biz = await conn.getBusinessProfile(jid);
        if (biz) business = true;
    } catch {}


    // ---------------------------------------------------------------------
    // 🧠 Lógica avanzada
    // ---------------------------------------------------------------------

    // ❌ NO REGISTRADO
    if (!exists && statusError?.includes("404")) {
        return m.reply(
`📱 Número: https://wa.me/${number}

❌ *NO REGISTRADO EN WHATSAPP*
📌 El servidor responde 404 (no existe).`
        );
    }

    // ⚠️ REVISIÓN TEMPORAL
    if (exists && !statusOk && statusError?.includes("403")) {
        return m.reply(
`📱 Número: https://wa.me/${number}

🟡 *EN REVISIÓN TEMPORAL POR WHATSAPP*
📌 El número existe pero está momentáneamente desactivado.
📌 Esto ocurre cuando WhatsApp revisa la cuenta por actividad sospechosa.`
        );
    }

    // ⚠️ POSIBLE SUSPENSIÓN PERMANENTE
    if (exists && !statusOk && statusError && !statusError.includes("403")) {
        return m.reply(
`📱 Número: https://wa.me/${number}

🔴 *POSIBLE SUSPENSIÓN PERMANENTE*
📌 Existe, pero no responde ninguna API oficial.
📌 Esto coincide con cuentas eliminadas o suspendidas permanentemente.`
        );
    }

    // 🟢 ACTIVA + INFO
    if (exists && statusOk) {
        return m.reply(
`📱 Número: https://wa.me/${number}

🟢 *REGISTRADO Y ACTIVO EN WHATSAPP*

${business ? "🏢 *Cuenta Business*" : "👤 Cuenta personal"}

📌 Responde correctamente a todas las validaciones.
📌 No está en revisión ni suspendido.`
        );
    }

    // ⚪ Caso raro: existe pero no responde nada
    return m.reply(
`📱 Número: https://wa.me/${number}

⚪ *EXISTE PERO NO RESPONDE*
📌 Puede ser:
  - Revisión temporal
  - Creación reciente
  - Datos limitados por privacidad
  - Error interno del servidor`
    );
};

handler.command = /^wa$/i;
export default handler;