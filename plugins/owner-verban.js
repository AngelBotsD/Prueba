import fetch from "node-fetch"

// Detecta operador por prefijos reales
function getCarrier(number) {
    // Quitar código de país si es MX (+52)
    let n = number
    if (n.startsWith("52")) n = n.slice(2)

    // Solo aplica para números de México (10 dígitos)
    if (n.length !== 10) return "Desconocido"

    const prefix = n.slice(0, 3)

    const carriers = {
        // Telcel
        "281": "Telcel", "222": "Telcel", "229": "Telcel",
        "722": "Telcel", "551": "Telcel", "552": "Telcel",
        "553": "Telcel", "554": "Telcel", "55": "Telcel",
        // Movistar
        "331": "Movistar", "332": "Movistar", "333": "Movistar",
        "818": "Movistar",
        // AT&T
        "444": "AT&T", "449": "AT&T", "477": "AT&T",
        "812": "AT&T", "813": "AT&T",
        // Unefon
        "771": "Unefon",
        // Virgin Mobile
        "999": "Virgin Mobile",
        // Altán (OMVs: Bait, Newww, Oxxo Cel, Diri, PilloFon, Megamóvil etc.)
        "558": "Altán", "557": "Altán", "556": "Altán",
        "562": "Altán", "563": "Altán",
    }

    // Si coincide
    if (carriers[prefix]) return carriers[prefix]

    return "Desconocido"
}

let handler = async (m, { conn, args }) => {
    if (!args[0]) 
        return m.reply(`⚠️ *Falta el número*\n\n📌 Ejemplo:\n.wa +52 722 758 4934`)

    let number = args.join(" ").replace(/\D/g, "")
    let jid = number + "@s.whatsapp.net"
    let link = `https://wa.me/${number}`

    await m.reply("🔍 *Analizando número...*")

    // Obtener operador
    let carrier = getCarrier(number)

    // 1️⃣ Verificar si existe
    let existsCheck = await conn.onWhatsApp(number)
    let exists = existsCheck?.[0]?.exists || false

    // 2️⃣ Estado de la cuenta
    let statusFail = false
    try { await conn.fetchStatus(jid) } catch { statusFail = true }

    // 3️⃣ Foto de perfil
    let ppFail = false
    try { await conn.profilePictureUrl(jid, "image") } catch { ppFail = true }

    // 4️⃣ Revisión wa.me
    let suspendedByWaMe = false
    try {
        let w = await fetch(link)
        let t = await w.text()
        if (t.includes("invalid") || t.includes("not a valid") || w.status === 404)
            suspendedByWaMe = true
    } catch {
        suspendedByWaMe = true
    }

    // Lógica final
    let score = 0
    if (!exists) score += 2
    if (statusFail) score += 2
    if (ppFail) score += 3
    if (suspendedByWaMe) score += 3

    if (score >= 4) {
        return m.reply(
`🔴 *Número suspendido permanentemente*
📡 Operador: *${carrier}*

${link}`
        )
    }

    if (score >= 2) {
        return m.reply(
`🟠 *Número con fallas — posible suspensión*
📡 Operador: *${carrier}*

${link}`
        )
    }

    return m.reply(
`🟢 *Número activo*
📡 Operador: *${carrier}*

${link}`
    )
}

handler.command = /^wa$/i
export default handler