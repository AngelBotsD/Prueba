import { delay } from "@whiskeysockets/baileys"

let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply("⚠️ Escribe un número. Ejemplo: *.wa 527227584934*")

    let num = args[0].replace(/\D/g, "")
    if (!num) return m.reply("⚠️ Número inválido")

    try {
        let res = await conn.requestRegistrationCode({
            phoneNumber: num,
            phoneNumberCountry: "MX",
            phoneNumberNational: num
        })

        await delay(300)

        let data = res?.error?.output?.payload || res
        let raw = JSON.stringify(data, null, 4)

        // 📌 Baneado
        if (data?.banned) {
            return m.reply(
                "❌ *NÚMERO BANEADO PERMANENTE*\n\n" +
                "• Razón: " + (data.reason || "Desconocida") + "\n" +
                "• Tipo de violación: " + (data.violation_type || "N/A") + "\n" +
                "• Login: " + (data.details?.login || num) +
                "\n\n```json\n" + raw + "\n```"
            )
        }

        // 📌 Temporal
        if (data?.temporary) {
            return m.reply(
                "⚠️ *REVISIÓN TEMPORAL*\n\n" +
                "• Motivo: " + (data.reason || "Bloqueo temporal") + "\n" +
                "• Login: " + (data.details?.login || num) +
                "\n\n```json\n" + raw + "\n```"
            )
        }

        // 📌 Fallo normal
        if (data?.reason && data?.status === "fail") {
            return m.reply(
                "❗ *Fallo en el registro*\n\n" +
                "• Razón: " + data.reason + "\n" +
                "• Tipo: " + (data.violation_type || "N/A") +
                "\n\n```json\n" + raw + "\n```"
            )
        }

        // 📌 Activo
        if (res?.method) {
            return m.reply(
                "✅ *EL NÚMERO ESTÁ ACTIVO EN WHATSAPP*\n\n" +
                "• Código enviado por: " + res.method + "\n" +
                "• Estado: OK" +
                "\n\n```json\n" + raw + "\n```"
            )
        }

        return m.reply("❔ No se pudo determinar el estado\n\n```json\n" + raw + "\n```")

    } catch (e) {
        return m.reply("⚠️ Error interno: " + e.message)
    }
}

handler.command = /^wa$/i
export default handler