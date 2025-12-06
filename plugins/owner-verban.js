import { delay } from "@whiskeysockets/baileys"

let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply("⚠️ Escribe un número. Ejemplo: *.wa 527227584934*")

    let num = args[0].replace(/\D/g, "")
    if (!num) return m.reply("⚠️ Número inválido")

    try {
        // NUEVA FUNCIÓN CORRECTA PARA DS6/META
        let code = await conn.requestPairingCode(num)

        await delay(300)

        // 📌 Si devuelve un código → el número está activo
        if (code) {
            return m.reply(
                "✅ *EL NÚMERO ESTÁ ACTIVO EN WHATSAPP*\n\n" +
                "• Código generado (pairing): " + code + "\n" +
                "• Estado: OK"
            )
        }

        // 📌 Si no devolvió nada
        return m.reply(
            "❌ No se pudo obtener el estado del número.\n" +
            "Puede estar temporal, limitado o no válido."
        )

    } catch (e) {
        return m.reply("⚠️ Error interno: " + e.message)
    }
}

handler.command = /^wa$/i
export default handler