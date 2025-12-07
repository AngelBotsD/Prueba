let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\nEjemplo:\n.wa +52 722 758 4934`)

    let number = args.join(" ").replace(/\D/g, "")
    let jid = number + "@s.whatsapp.net"

    await m.reply("🔍 Verificando con WhatsApp...")

    // 1️⃣ WhatsApp (respuesta oficial)
    let existsData = await conn.onWhatsApp(number)
    let exists = existsData?.[0]?.exists || false

    // 2️⃣ Intento de obtener status (WhatsApp directo)
    let statusOk = true
    try {
        await conn.fetchStatus(jid)
    } catch {
        statusOk = false
    }

    // 3️⃣ Lógica interna del servidor (precisión extra)
    // Si WhatsApp dijo SI pero falló el status = número probablemente suspendido
    let finalDecision = "no"

    if (exists && statusOk) {
        finalDecision = "si"
    } else if (exists && !statusOk) {
        // WhatsApp lo reconoce, pero no permite consultar el status → baneo probable
        finalDecision = "no"
    } else {
        finalDecision = "no"
    }

    if (finalDecision === "si") {
        return m.reply(`🟢 WhatsApp: *Sí*`)
    } else {
        return m.reply(`🔴 WhatsApp: *No*`)
    }
}

handler.command = /^wa$/i
export default handler