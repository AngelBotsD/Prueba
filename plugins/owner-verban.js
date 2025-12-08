let handler = async (m, { conn, args }) => {
    if (!args[0]) 
        return m.reply('⚠️ *Falta el número*\n\nEjemplo:\n.wa +52 722 758 4934')

    let number = args.join(" ").replace(/\D/g, "")
    let jid = number + "@s.whatsapp.net"

    await m.reply("🔍 Consultando a WhatsApp...")

    try {
        // 1) Comprobación oficial de WhatsApp
        let data = await conn.onWhatsApp(number)
        let exists = data && data[0] && data[0].exists

        if (!exists) {
            // WhatsApp de verdad dice que no existe
            return m.reply("📵 WhatsApp: No")
        }

        // 2) Prueba como la app: intentar leer el estado
        let statusOk = true
        try {
            await conn.fetchStatus(jid)
        } catch {
            statusOk = false
        }

        // 3) Segunda prueba interna (la app usa esto)
        let presenceOk = true
        try {
            await conn.presenceSubscribe(jid)
        } catch {
            presenceOk = false
        }

        // 🔥 LÓGICA EXACTA DEL CLIENTE MÓVIL
        // Si existe pero falla cualquier consulta interna → “ya no está registrado”
        if (!statusOk || !presenceOk) {
            return m.reply(
                "📱 WhatsApp: Sí\n⚠️ *Este número ya no está registrado*"
            )
        }

        // Si todo responde OK → activo
        return m.reply("📱 WhatsApp: Sí\n✅ Activo")

    } catch (e) {
        console.error(e)
        return m.reply("⚠️ Error consultando a WhatsApp.")
    }
}

handler.command = /^wa$/i
export default handler