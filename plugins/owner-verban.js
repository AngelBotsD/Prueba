let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\n📌 Ejemplo: .wa +52 722 758 4934`);

    const number = args.join(" ").replace(/\D/g, "");
    const jid = number + "@s.whatsapp.net";

    await m.reply(`🔍 *Analizando número...*`);

    // ------------------------
    // 1) EXISTE?
    // ------------------------
    let existsNow = false;
    try {
        const wa = await conn.onWhatsApp(jid);
        existsNow = !!(wa && wa[0]?.exists);
    } catch {}

    if (!existsNow) {
        return m.reply(`
📱 Número: https://wa.me/${number}

❌ *NO REGISTRADO EN WHATSApp*
        `);
    }

    // ------------------------
    // 2) PRUEBAS
    // ------------------------
    let pp = false, status = false, assert = false, presence = false;
    let assertErr = "";

    try { await conn.profilePictureUrl(jid, 'image'); pp = true; } catch {}
    try { await conn.fetchStatus(jid); status = true; } catch {}
    
    try { 
        await conn.assertJidExists(jid); 
        assert = true; 
    } catch (e) {
        assertErr = e?.message || "";
    }

    try { await conn.presenceSubscribe(jid); presence = true; } catch {}

    // ------------------------
    // 3) DETECCIÓN REAL DE BAN PERMANENTE para ds6/meta
    // ------------------------

    const bannedPatterns = [
        "not-authorized",
        "401",
        "403",
        "400",
        "bad request",
        "forbidden",
        "unauthorized"
    ];

    const isPermanentBan =
        assert === false &&
        bannedPatterns.some(x => assertErr.toLowerCase().includes(x)) &&
        !pp &&
        !status &&
        !presence;

    if (isPermanentBan) {
        return m.reply(`
📱 Número: https://wa.me/${number}

🔴 *BANEADO PERMANENTE POR WHATSAPP*

🧪 Indicadores:
▪ Foto: ${pp}
▪ Status: ${status}
▪ assertJid: ${assert}
▪ Presencia: ${presence}

🛑 Error del servidor:
${assertErr}
        `);
    }

    // ------------------------
    // BLOQUEO TEMPORAL
    // ------------------------
    if (!status && !presence && assert === true) {
        return m.reply(`
📱 Número: https://wa.me/${number}

🟠 *BLOQUEO TEMPORAL*
        `);
    }

    // ------------------------
    // ACTIVO
    // ------------------------
    return m.reply(`
📱 Número: https://wa.me/${number}

🟢 *ACTIVO*
Este número está funcionando normalmente.
    `);
};

handler.command = /^wa$/i;
export default handler;