import makeWASocket, { delay } from "@whiskeysockets/baileys"

let handler = async (m, { args }) => {
    if (!args[0]) return m.reply("⚠️ Escribe un número. Ejemplo: *.wa 527227584934*")

    let num = args[0].replace(/\D/g, "")
    if (!num) return m.reply("⚠️ Número inválido")

    // 🔥 Socket temporal que NO afecta al bot
    let sock = makeWASocket({
        auth: { creds: {}, keys: {} },
        printQRInTerminal: false,
        logger: { fatal(){}, error(){}, warn(){}, info(){}, debug(){}, trace(){} }
    })

    try {
        let res = await sock.requestRegistrationCode({
            phoneNumber: num,
            phoneNumberCountry: "MX",
            phoneNumberNational: num
        })

        await delay(400)

        let data = res?.error?.output?.payload || res
        let raw = JSON.stringify(data, null, 4)

        // 🟥 BAN PERMANENTE
        if (data?.banned) {
            await sock.ws.close()
            return m.reply(
                "❌ *NÚMERO BANEADO PERMANENTE*\n\n" +
                "• Razón: " + (data.reason || "Desconocida") + "\n" +
                "• Tipo: " + (data.violation_type || "N/A") + "\n" +
                "• Login: " + (data.details?.login || num) +
                "\n\n```json\n" + raw + "\n```"
            )
        }

        // 🟧 BLOQUEO TEMPORAL
        if (data?.temporary) {
            await sock.ws.close()
            return m.reply(
                "⚠️ *REVISIÓN TEMPORAL / BLOQUEO TEMPORAL*\n\n" +
                "• Motivo: " + (data.reason || "Bloqueo temporal") + "\n" +
                "• Login: " + (data.details?.login || num) +
                "\n\n```json\n" + raw + "\n```"
            )
        }

        // ❗ Fallo normal
        if (data?.reason && data?.status === "fail") {
            await sock.ws.close()
            return m.reply(
                "❗ *Fallo en el registro*\n\n" +
                "• Razón: " + data.reason + "\n" +
                "• Tipo: " + (data.violation_type || "N/A") +
                "\n\n```json\n" + raw + "\n```"
            )
        }

        // 🟢 Número activo
        if (res?.method) {
            await sock.ws.close()
            return m.reply(
                "✅ *EL NÚMERO ESTÁ ACTIVO EN WHATSAPP*\n\n" +
                "• Código enviado por: " + res.method +
                "\n• Estado: OK" +
                "\n\n```json\n" + raw + "\n```"
            )
        }

        await sock.ws.close()
        return m.reply(
            "❔ No se pudo determinar el estado\n\n```json\n" + raw + "\n```"
        )

    } catch (e) {
        await sock?.ws?.close()?.catch(() => {})
        return m.reply("⚠️ Error interno: " + e.message)
    }
}

handler.command = /^wa$/i
export default handler