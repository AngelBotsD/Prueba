let handler = async (m, { conn }) => {
    // Extraer TODO el texto después de .wa
    let text = m.text.replace(/^\.wa/i, "").trim();

    if (!text) {
        return m.reply(`⚠️ *Falta el número*\n\nEjemplo: .wa +52 722 758 4934`);
    }

    // Limpiar el número: quitar espacios, +, -, paréntesis, letras, etc.
    let number = text.replace(/\D/g, "");

    if (!number) return m.reply(`⚠️ No se detectó un número válido.`);

    let jid = number + "@s.whatsapp.net";

    try {
        const query = await conn.query({
            tag: "iq",
            attrs: {
                to: "s.whatsapp.net",
                type: "get",
                xmlns: "urn:xmpp:whatsapp:account"
            },
            content: [
                { tag: "ban", attrs: {}, content: [] }
            ]
        });

        let node = query?.content?.[0];

        let result = {
            banned: false,
            reason: "Unknown",
            details: {
                login: number,
                status: "ok",
                violation_type: "0"
            }
        };

        if (node?.attrs?.type === "permanent" || node?.attrs?.status === "fail") {
            result.banned = true;
            result.reason = node?.attrs?.reason || "Unknown";
            result.details.status = "fail";
            result.details.violation_type = node?.attrs?.violation_type || "0";
        }

        let jsonText = "```" + JSON.stringify(result, null, 4) + "```";

        console.log(jsonText);
        await conn.sendMessage(m.chat, { text: jsonText }, { quoted: m });

    } catch (e) {
        console.log("❌ Error WA Check:", e);
        return m.reply(`❌ Error al verificar el número.`);
    }
};

handler.command = /^wa$/i;
export default handler;