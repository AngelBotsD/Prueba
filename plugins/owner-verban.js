let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\n📌 Ejemplo: .wa +52 722 758 4934`);

    // limpiar número
    const number = args.join(" ").replace(/\D/g, "");
    const jid = number + "@s.whatsapp.net";

    await m.reply(`🔍 *Analizando número...*`);

    // ============================================
    // 📌 FUNCIÓN QUE NO SE TRABA — Timeout propio
    // ============================================
    const safeQuery = (queryData, ms = 4000) => {
        return Promise.race([
            conn.query(queryData).catch(() => null),
            new Promise(resolve => setTimeout(() => resolve(null), ms))
        ]);
    };

    // =============================
    // ✔ 1. Verificar si existe
    // =============================
    let existsNow = false;
    try {
        const wa = await conn.onWhatsApp(jid);
        existsNow = !!(wa && wa[0]?.exists);
    } catch {}

    if (!existsNow) {
        return m.reply(`
📱 Número: https://wa.me/${number}

❌ *NO ESTÁ REGISTRADO EN WHATSAPP*
Pudo ser:
- eliminado
- reciclado
- o baneado hace tiempo
        `);
    }

    // =============================
    // ✔ 2. Pruebas internas
    // =============================
    let pp = false, status = false, assert = false, presence = false;

    try { await conn.profilePictureUrl(jid, 'image'); pp = true; } catch {}
    try { await conn.fetchStatus(jid); status = true; } catch {}
    try { await conn.assertJidExists(jid); assert = true; } catch {}
    try { await conn.presenceSubscribe(jid); presence = true; } catch {}

    // =============================
    // ✔ 3. Intento de BAN REAL (con timeout)
    // =============================
    let serverBan = {
        banned: false,
        reason: "Unknown",
        violation: "0",
        status: "ok"
    };

    const serverResp = await safeQuery({
        tag: "iq",
        attrs: {
            to: "s.whatsapp.net",
            type: "get",
            xmlns: "urn:xmpp:whatsapp:account"
        },
        content: [{ tag: "ban", attrs: {}, content: [] }]
    });

    if (serverResp?.content?.[0]?.attrs) {
        let a = serverResp.content[0].attrs;

        if (a.status === "fail" || a.type === "permanent") {
            serverBan.banned = true;
            serverBan.status = a.status || "fail";
            serverBan.reason = a.reason || "Unknown";
            serverBan.violation = a.violation_type || "0";
        }
    }

    // =============================
    // 🔥 DETECCIÓN FINAL
    // =============================

    if (serverBan.banned) {
        return m.reply(`
📱 Número: https://wa.me/${number}

🔴 *BANEADO PERMANENTE POR WHATSAPP*

🧪 Servidor:
▪ Estado: *${serverBan.status}*
▪ Razón: *${serverBan.reason}*
▪ Violación: *${serverBan.violation}*

📊 Indicadores internos:
▪ Foto: *${pp}*
▪ Status: *${status}*
▪ assertJid: *${assert}*
▪ Presencia: *${presence}*
        `);
    }

    // bloqueo temporal
    if (!status && !presence) {
        return m.reply(`
📱 Número: https://wa.me/${number}

🟠 *BLOQUEO TEMPORAL DETECTADO*

📊 Indicadores:
▪ Foto: *${pp}*
▪ Status: *${status}*
▪ assertJid: *${assert}*
▪ Presencia: *${presence}*
        `);
    }

    // activo
    return m.reply(`
📱 Número: https://wa.me/${number}

🟢 *ESTADO: ACTIVO EN WHATSAPP*

📊 Indicadores:
▪ Foto: *${pp}*
▪ Status: *${status}*
▪ assertJid: *${assert}*
▪ Presencia: *${presence}*
    `);
};

handler.command = /^wa$/i;
export default handler;