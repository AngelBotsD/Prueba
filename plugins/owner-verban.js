let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\n📌 Ejemplo: .wa +52 722 758 4934`);

    // Limpiar número
    const number = args.join(" ").replace(/\D/g, "");
    const jid = number + "@s.whatsapp.net";

    await m.reply(`🔍 *Analizando número...*`);

    let existsNow = false;
    let pp = false;
    let status = false;
    let assert = false;
    let presence = false;

    // -----------------------------------------
    // ✔️ 1. Verificar si existe en WhatsApp
    // -----------------------------------------
    try {
        const wa = await conn.onWhatsApp(jid);
        existsNow = !!(wa && wa[0] && wa[0].exists);
    } catch {}

    if (!existsNow) {
        return m.reply(`
📱 Número: https://wa.me/${number}

❌ *NO REGISTRADO EN WHATSAPP*
Este número no tiene sesión activa o fue borrado.
        `);
    }

    // -----------------------------------------
    // ✔️ 2. Probar funciones internas (tu sistema)
    // -----------------------------------------
    try { await conn.profilePictureUrl(jid, 'image'); pp = true; } catch {}
    try { await conn.fetchStatus(jid); status = true; } catch {}
    try { await conn.assertJidExists(jid); assert = true; } catch {}
    try { await conn.presenceSubscribe(jid); presence = true; } catch {}

    // -----------------------------------------
    // ✔️ 3. Consultar BAN REAL con servidor WhatsApp
    // -----------------------------------------
    let serverBan = {
        banned: false,
        reason: "Unknown",
        violation: "0",
        status: "ok"
    };

    try {
        const resp = await conn.query({
            tag: "iq",
            attrs: {
                to: "s.whatsapp.net",
                type: "get",
                xmlns: "urn:xmpp:whatsapp:account"
            },
            content: [{ tag: "ban", attrs: {}, content: [] }]
        });

        let node = resp?.content?.[0];

        if (node?.attrs?.status === "fail" || node?.attrs?.type === "permanent") {
            serverBan.banned = true;
            serverBan.reason = node?.attrs?.reason || "Unknown";
            serverBan.status = node?.attrs?.status || "fail";
            serverBan.violation = node?.attrs?.violation_type || "0";
        }
    } catch (e) {
        // Si falla el servidor no lo marcamos como ban
    }

    // -----------------------------------------
    // 🔥 DETECCIÓN FINAL (combinada)
    // -----------------------------------------

    // BANEO REAL DEL SERVIDOR
    if (serverBan.banned) {
        return m.reply(`
📱 Número: https://wa.me/${number}

🔴 *BANEADO PERMANENTE POR WHATSAPP*
Este número aparece BLOQUEADO por el servidor oficial.

🧪 *Detalles del servidor*
▪ Estado: *${serverBan.status}*
▪ Razón: *${serverBan.reason}*
▪ Código violación: *${serverBan.violation}*

📊 *Indicadores internos*
▪ Foto: *${pp}*
▪ Status: *${status}*
▪ assertJid: *${assert}*
▪ Presencia: *${presence}*
        `);
    }

    // BLOQUEO TEMPORAL
    if (!status && !presence && existsNow && !serverBan.banned) {
        return m.reply(`
📱 Número: https://wa.me/${number}

🟠 *BLOQUEO TEMPORAL*
WhatsApp limita consultas internas pero NO está baneado por servidor.

📊 Indicadores:
▪ Foto: *${pp}*
▪ Status: *${status}*
▪ assertJid: *${assert}*
▪ Presencia: *${presence}*
        `);
    }

    // CUENTA ACTIVA
    return m.reply(`
📱 Número: https://wa.me/${number}

🟢 *ESTADO: ACTIVO*
Este número está funcionando normalmente.

📊 Indicadores:
▪ Foto: *${pp}*
▪ Status: *${status}*
▪ assertJid: *${assert}*
▪ Presencia: *${presence}*
    `);
};

handler.command = /^wa$/i;
export default handler;