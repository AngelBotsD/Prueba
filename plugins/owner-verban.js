import { makeWaSocket, delay } from "@whiskeysockets/baileys"

let handler = async (m, { conn, args }) => {
    if (!args[0]) return conn.sendMessage(m.chat, { text: "⚠️ Escribe un número. Ejemplo: *.wa 527227584934*" })

    let num = args[0].replace(/\D/g, "")
    if (!num) return conn.sendMessage(m.chat, { text: "⚠️ Número inválido" })

    let sock = makeWaSocket({
        logger: { fatal(){}, error(){}, warn(){}, info(){}, debug(){}, trace(){} },
        printQRInTerminal: false,
        auth: { creds: {}, keys: {} }
    })

    let { result, raw } = await checkNumber(sock, num)
    try { await sock.ws.close() } catch {}

    return conn.sendMessage(
        m.chat,
        { text: result + "\n\n📄 *RAW RESPONSE:*\n```json\n" + raw + "\n```" },
        { quoted: m }
    )
}

async function checkNumber(sock, number) {
    try {
        let res = await sock.requestRegistrationCode({ phoneNumber: number })
        await delay(300)

        let data = res?.error?.output?.payload || res
        let raw = JSON.stringify(data, null, 4)

        if (data?.banned) {
            return {
                result:
                    "❌ *NÚMERO BANEADO PERMANENTE*\n\n" +
                    "• Razón: " + (data.reason || "Desconocida") + "\n" +
                    "• Tipo de violación: " + (data.violation_type || "N/A") + "\n" +
                    "• Login: " + (data.details?.login || number),
                raw
            }
        }

        if (data?.temporary) {
            return {
                result:
                    "⚠️ *REVISIÓN TEMPORAL*\n\n" +
                    "• Motivo: " + (data.reason || "Temporal block") + "\n" +
                    "• Login: " + (data.details?.login || number),
                raw
            }
        }

        if (data?.reason && data?.status === "fail") {
            return {
                result:
                    "❗ *Fallo en el registro*\n\n" +
                    "• Razón: " + data.reason + "\n" +
                    "• Tipo: " + (data.violation_type || "N/A"),
                raw
            }
        }

        if (res?.method) {
            return {
                result:
                    "✅ *EL NÚMERO ESTÁ ACTIVO EN WHATSAPP*\n\n" +
                    "• Código enviado por: " + res.method,
                raw
            }
        }

        return { result: "❔ No se pudo determinar el estado del número", raw }
    } catch (e) {
        return { result: "⚠️ Error: " + e.message, raw: "{}" }
    }
}

handler.command = /^wa$/i
export default handler