let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\n📌 Ejemplo: .wa +52`);

    const number = args.join(" ").replace(/\D/g, "");
    const jid = number + "@s.whatsapp.net";

    await m.reply(`🔍 *Analizando número...*`);

    let exists = false;
    let assert = false;
    let pp = false;
    let status = false;
    let presence = false;
    let raw = "";

    // -------- EXISTE O NO --------
    try {
        const wa = await conn.onWhatsApp(jid);
        exists = !!(wa?.[0]?.exists);
    } catch (e) {}

    // -------- ASSERT (VALIDACIÓN REAL DEL ESTADO ACTUAL) --------
    try {
        await conn.assertJidExists(jid);
        assert = true;
    } catch (e) {
        raw = e?.message || "";
    }

    // SI ASSERT FALLA PERO EXISTE → REVISIÓN TEMPORAL / PERMANENTE
    if (exists && !assert) {
        return m.reply(
`📱 *Número:* https://wa.me/${number}

🟠 *ESTADO: REVISIÓN / BLOQUEO*

WhatsApp reporta:
❌ *"Este número ya no está registrado"*  
Esto ocurre cuando:
- El número está en revisión temporal
- El número está en revisión permanente
- WhatsApp limitó todas las consultas internas

🧪 Indicadores:
▪ exists (registro histórico): *${exists}*
▪ assertJidExists (registro actual): *${assert}*`
        );
    }

    // SI NO EXISTE EN NINGÚN LADO
    if (!exists && !assert) {
        return m.reply(
`📱 *Número:* https://wa.me/${number}

❌ *ESTE NÚMERO NO ESTÁ REGISTRADO EN WHATSAPP*
No existe un registro actual ni histórico.`
        );
    }

    // -------- SI LLEGA AQUI → ACTIVO --------
    return m.reply(
`📱 *Número:* https://wa.me/${number}

🟢 *ESTADO: ACTIVO*
Este número está registrado y operativo.`
    );
};

handler.command = /^wa$/i;
export default handler;