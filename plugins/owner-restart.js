let handler = async (m, { conn }) => {
    try {
        // Asegurar que fs exista (sin imports)
        const fs = global.fs || require("fs");

        let msg = await conn.reply(m.chat, "🔄 Reiniciando el bot…", m);

        // Guardar info del mensaje para editar después
        const data = {
            chat: m.chat,
            msgId: msg.key.id
        };

        fs.writeFileSync("./last-restart.json", JSON.stringify(data));

        setTimeout(() => process.exit(0), 1500);

    } catch (error) {
        console.log(error);
        conn.reply(m.chat, String(error), m);
    }
};

handler.command = ['rei', 'restart'];
handler.rowner = true;

export default handler;