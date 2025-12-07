// --------------------------
// MINI WHATSAPP INTERNO
// --------------------------
async function whatsappCheck(conn, number) {
    let jid = number + "@s.whatsapp.net"

    // 1️⃣ Respuesta oficial de WhatsApp
    let existsData = await conn.onWhatsApp(number)
    let exists = existsData?.[0]?.exists || false

    // 2️⃣ Segunda capa (también WhatsApp)
    let statusOk = true
    try { 
        await conn.fetchStatus(jid) 
    } catch { 
        statusOk = false 
    }

    // --------------------------
    // LÓGICA DE TU WHATSAPP
    // --------------------------

    if (exists && statusOk) return "si"
    return "no"
}

// --------------------------
// HANDLER PRINCIPAL
// --------------------------
let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\nEjemplo:\n.wa +52 722 758 4934`)

    let number = args.join(" ").replace(/\D/g, "")

    await m.reply("🔍 Consultando con WhatsApp interno...")

    // Aquí SOLO usamos tu WhatsApp interno
    let result = await whatsappCheck(conn, number)

    if (result === "si") {
        return m.reply(`🟢 WhatsApp: *Sí*`)
    } else {
        return m.reply(`🔴 WhatsApp: *No*`)
    }
}

handler.command = /^wa$/i
export default handler