import fetch from "node-fetch"

let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\n📌 Ejemplo:\n.wa +234 702 024 9877`)

    let raw = args.join(" ").replace(/\D/g, "")
    let number = raw
    let jid = number + "@s.whatsapp.net"

    await m.reply(`🔍 *Analizando número...*`)

    // 🟩 1. Verificación básica Baileys
    let exists = await conn.onWhatsApp(number)
    let registered = exists?.[0]?.exists || false

    // 🟧 2. Verificar si el link wa.me está caído (indica suspensión)
    let waUrl = `https://wa.me/${number}`
    let suspended = false
    try {
        let page = await fetch(waUrl)
        let text = await page.text()

        // Heurística de suspensión
        if (text.includes("Phone number shared via url is invalid") ||
            text.includes("not a valid WhatsApp number") ||
            page.status === 404) {
            suspended = true
        }
    } catch {
        suspended = true
    }

    // 🟥 3. Segunda heurística: intentar decodificar JID
    let secondFail = false
    try {
        await conn.fetchStatus(jid)
    } catch {
        secondFail = true
    }

    // 🧠 Lógica final tipo “The Boss”
    if (!registered || suspended || secondFail) {
        return m.reply(
`🔴 *Número suspendido*

${waUrl}`
        )
    }

    // Si está bien
    return m.reply(
`🟢 *Número válido y activo*

${waUrl}`
    )
}

handler.help = ["wa <numero>"]
handler.command = /^wa$/i

export default handler