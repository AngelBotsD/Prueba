let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\n📌 Ejemplo: .wa +52 722 758 4934`);

    const number = args.join(" ").replace(/\D/g, "");
    const jid = number + "@s.whatsapp.net";

    await m.reply(`🔍 *Analizando número en WhatsApp...*`);

    let exists = false;
    let active = false;
    let business = false;
    let statusError = null;

    // --- 1) Verificación base ---
    let info = null;
    try {
        info = await conn.onWhatsApp(number);
        exists = info?.[0]?.exists || false;
    } catch {}

    // --- 2) Verificar estado ---
    try {
        const s = await conn.fetchStatus(jid);
        if (s?.status !== undefined) active = true;
    } catch (e) {
        statusError = (e?.message || "").toLowerCase();
    }

    // --- 3) Business profile ---
    try {
        const biz = await conn.getBusinessProfile(jid);
        if (biz) business = true;
    } catch {}


    // ---------------------------------------------------------------------
    // 🔥 Lógica ajustada 100% a ds6/meta
    // ---------------------------------------------------------------------

    // ❌ NO REGISTRADO
    if (!exists || statusError.includes("not found") || statusError.includes("404")) {
        return m.reply(
`📱 Número: https://wa.me/${number}

❌ *NO REGISTRADO EN WHATSAPP*`
        );
    }

    // 🟡 REVISIÓN TEMPORAL (ban temporal / revisión)
    if (!active && (statusError.includes("forbidden") || statusError.includes("403"))) {
        return m.reply(
`📱 Número: https://wa.me/${number}

🟡 *EN REVISIÓN TEMPORAL POR WHATSAPP*
📌 Existe, pero WhatsApp desactivó temporalmente el acceso al perfil.`
        );
    }

    // 🔴 SUSPENSIÓN / BAN PERMANENTE
    if (!active && exists && statusError && !statusError.includes("forbidden")) {
        return m.reply(
`📱 Número: https://wa.me/${number}

🔴 *SUSPENDIDO O ELIMINADO PERMANENTE*
📌 Existe, pero el servidor bloquea 100% el acceso.`
        );
    }

    // 🟢 ACTIVO
    if (active && exists) {
        return m.reply(
`📱 Número: https://wa.me/${number}

🟢 *REGISTRADO Y ACTIVO*

${business ? "🏢 *Cuenta Business*" : "👤 Cuenta personal"}`
        );
    }

    // ⚪ Caso residual mínimo
    return m.reply(
`📱 Número: https://wa.me/${number}

⚪ *EXISTE PERO TIENE DATOS LIMITADOS*
📌 Puede ser:
- Cuenta nueva
- Privacidad al máximo
- Revisión suave`
    );
};

handler.command = /^wa$/i;
export default handler;