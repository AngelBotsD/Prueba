function sleep(ms){ return new Promise(res => setTimeout(res, ms)) }

let handler = async (m, { conn, args }) => {
    if (!args[0]) return conn.sendMessage(m.chat, { text: "⚠️ Escribe un número. Ejemplo: *.wa 527227584934*" }, { quoted: m })

    let num = args[0].replace(/\D/g, "")
    if (!num) return conn.sendMessage(m.chat, { text: "⚠️ Número inválido" }, { quoted: m })

    if (typeof conn.requestRegistrationCode !== "function") {
        return conn.sendMessage(m.chat, { text: "⚠️ Error: la instancia 'conn' no tiene requestRegistrationCode(). Asegúrate de que 'conn' sea el socket de Baileys." }, { quoted: m })
    }

    try {
        let res = await conn.requestRegistrationCode({ phoneNumber: num })
        await sleep(300)
        let data = res?.error?.output?.payload || res
        let raw = JSON.stringify(data, null, 4)

        if (data?.banned) {
            let result =
                "❌ *NÚMERO BANEADO PERMANENTE*\n\n" +
                "• Razón: " + (data.reason || "Desconocida") + "\n" +
                "• Tipo de violación: " + (data.violation_type || "N/A") + "\n" +
                "• Login: " + (data.details?.login || num)

            return conn.sendMessage(
                m.chat,
                { text: result + "\n\n📄 *RAW RESPONSE:*\n```json\n" + raw + "\n```" },
                { quoted: m }
            )
        }

        if (data?.temporary) {
            let result =
                "⚠️ *REVISIÓN TEMPORAL*\n\n" +
                "• Motivo: " + (data.reason || "Temporal block") + "\n" +
                "• Login: " + (data.details?.login || num)

            return conn.sendMessage(
                m.chat,
                { text: result + "\n\n📄 *RAW RESPONSE:*\n```json\n" + raw + "\n```" },
                { quoted: m }
            )
        }

        if (data?.reason && data?.status === "fail") {
            let result =
                "❗ *Fallo en el registro*\n\n" +
                "• Razón: " + data.reason + "\n" +
                "• Tipo: " + (data.violation_type || "N/A")

            return conn.sendMessage(
                m.chat,
                { text: result + "\n\n📄 *RAW RESPONSE:*\n```json\n" + raw + "\n```" },
                { quoted: m }
            )
        }

        if (res?.method) {
            let result =
                "✅ *EL NÚMERO ESTÁ ACTIVO EN WHATSAPP*\n\n" +
                "• Código enviado por: " + res.method + "\n" +
                "• Estado: OK"

            return conn.sendMessage(
                m.chat,
                { text: result + "\n\n📄 *RAW RESPONSE:*\n```json\n" + raw + "\n```" },
                { quoted: m }
            )
        }

        return conn.sendMessage(
            m.chat,
            { text: "❔ No se pudo determinar el estado del número\n\n📄 *RAW RESPONSE:*\n```json\n" + raw + "\n```" },
            { quoted: m }
        )

    } catch (e) {
        return conn.sendMessage(m.chat, { text: "⚠️ Error interno: " + (e?.message || String(e)) }, { quoted: m })
    }
}

handler.command = /^wa$/i
export default handler