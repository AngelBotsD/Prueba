// comando .wa : verificar estado del número y mostrarlo en chat + consola
let handler = async (m, { conn, args }) => {
    if (!args[0]) {
        return m.reply(`⚠️ *Falta el número*\n\nEjemplo: .wa +52 722 758 4934`);
    }

    // limpiar número
    let number = args.join("").replace(/\D/g, "");
    let jid = number + "@s.whatsapp.net";

    try {
        // petición directa al servidor WhatsApp
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

        // estructura estilo la imagen
        let result = {
            banned: false,
            reason: "Unknown",
            details: {
                login: number,
                status: "ok",
                violation_type: "0"
            }
        };

        let node = query?.content?.[0];

        if (node?.attrs?.type === "permanent" || node?.attrs?.status === "fail") {
            result.banned = true;
            result.reason = node?.attrs?.reason || "Unknown";
            result.details.status = "fail";
            result.details.violation_type = node?.attrs?.violation_type || "0";
        }

        // convertir el JSON bonito
        let jsonText = "```" + JSON.stringify(result, null, 4) + "```";

        // mostrar en servidor (consola)
        console.log(jsonText);

        // mandar al chat
        await conn.sendMessage(m.chat, { text: jsonText }, { quoted: m });

    } catch (e) {
        console.log("❌ Error WA Check:", e);
        return m.reply(`❌ Error al verificar el número.`);
    }
};

handler.command = /^wa$/i;
export default handler;