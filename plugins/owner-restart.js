let handler = async (m, { conn }) => {
    try {
        // Cargar fs en ESM SIN imports arriba
        const fs = (await import("fs")).default;

        // Enviar mensaje de reinicio
        let msg = await conn.reply(m.chat, "🔄 Reiniciando el bot…", m);

        // Guardar datos para editar después
        const data = {
            chat: m.chat,
            msgId: msg.key.id
        };

        fs.writeFileSync("./last-restart.json", JSON.stringify(data));

        // Reiniciar
        setTimeout(() => process.exit(0), 1500);

    } catch (error) {
        console.error(error);
        conn.reply(m.chat, String(error), m);
    }
};

handler.command = ['rei', 'restart'];
handler.rowner = true;

export default handler;