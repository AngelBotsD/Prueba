import makeWASocket, { delay } from "@whiskeysockets/baileys"

let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply("⚠️ Escribe un número. Ejemplo: *.wa 527227584934*")

    let num = args[0].replace(/\D/g, "")
    if (!num) return m.reply("⚠️ Número inválido")

    let sock = makeWASocket({
        logger: { fatal(){}, error(){}, warn(){}, info(){}, debug(){}, trace(){} },
        printQRInTerminal: false,
        auth: { creds: {}, keys: {} }
    })

    let res = await checkNumber(sock, num)
    try { await sock.ws.close() } catch {}

    return m.reply(res)
}

async function checkNumber(sock, number) {
    try {
        let res = await sock.requestRegistrationCode({ phoneNumber: number })
        await delay(300)

        let data = res?.error?.output?.payload || res
        let raw = JSON.stringify(data, null, 4)

        if (data?.banned) {
            return (
                "❌ *NÚMERO BANEADO PERMANENTE*\n\n" +
                "• Razón: " + (data.reason || "Desconocida") + "\n" +
                "• Tipo de violación: " + (data.violation_type || "N/A") + "\n" +
                "• Login: " + (data.details?.login || number) +
                "\n\n📄 *RAW:*\n```json\n" + raw + "\n```"
            )
        }

        if (data?.temporary) {
            return (
                "⚠️ *REVISIÓN TEMPORAL*\n\n" +
                "• Motivo: " + (data.reason || "Temporal block") + "\n" +
                "• Login: " + (data.details?.login || number) +
                "\n\n📄 *RAW:*\n```json\n" + raw + "\n```"
            )
        }

        if (data?.reason && data?.status === "fail") {
            return (
                "❗ *Fallo en el registro*\n\n" +
                "• Razón: " + data.reason + "\n" +
                "• Tipo: " + (data.violation_type || "N/A") +
                "\n\n📄 *RAW:*\n```json\n" + raw + "\n```"
            )
        }

        if (res?.method) {
            return (
                "✅ *EL NÚMERO ESTÁ ACTIVO EN WHATSAPP*\n\n" +
                "• Código enviado por: " + res.method +
                "\n\n📄 *RAW:*\n```json\n" + raw + "\n```"
            )
        }

        return "❔ No se pudo determinar el estado del número\n\nRAW:\n```json\n" + raw + "\n```"
    } catch (e) {
        return "⚠️ Error: " + e.message
    }
}

handler.command = /^wa$/i
export default handler