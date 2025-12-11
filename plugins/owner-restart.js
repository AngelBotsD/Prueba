let handler = async (m, { conn }) => {
    try {
        let msg = await conn.reply(m.chat, "🔄 Reiniciando el bot…", m);

        // Guardar la info para editar después
        let data = {
            chat: m.chat,
            msgId: msg.key.id
        };

        fs.writeFileSync("./last-restart.json", JSON.stringify(data));

        setTimeout(() => process.exit(0), 1500);

    } catch (error) {
        console.log(error);
        conn.reply(m.chat, `${error}`, m);
    }
};

handler.command = ['rei', 'restart'];
handler.rowner = true;
export default handler;