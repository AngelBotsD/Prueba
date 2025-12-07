import fetch from "node-fetch"

let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\n📌 Ejemplo:\n.wa +52 722 758 4934`)

    let number = args.join(" ").replace(/\D/g, "")
    let jid = number + "@s.whatsapp.net"
    let link = `https://wa.me/${number}`

    await m.reply("🔍 *Analizando número...*")

    // 1️⃣ Verificar si el número está en WhatsApp (existe)
    let existsCheck = await conn.onWhatsApp(number)
    let exists = existsCheck?.[0]?.exists || false

    // 2️⃣ Verificar si el número tiene estado (status)
    let statusFail = false
    try { await conn.fetchStatus(jid) } catch { statusFail = true }

    // 3️⃣ Comprobar la página wa.me (si da error o está caída, está suspendido)
    let suspendedByWaMe = false
    try {
        let w = await fetch(link)
        let t = await w.text()
        if (t.includes("invalid") || t.includes("not a valid") || w.status === 404)
            suspendedByWaMe = true
    } catch {
        suspendedByWaMe = true
    }

    // Lógica final — determine el estado basado en las verificaciones
    let score = 0
    if (!exists) score += 2
    if (statusFail) score += 2
    if (suspendedByWaMe) score += 3

    if (score >= 4) {
        return m.reply(
`🔴 *Número suspendido permanentemente*

${link}`
        )
    }

    if (score >= 2) {
        return m.reply(
`🟠 *Número con fallas — posible suspensión*

${link}`
        )
    }

    return m.reply(
`🟢 *Número activo*

${link}`
    )
}

handler.command = /^wa$/i
export default handler