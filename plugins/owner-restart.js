import fs from "fs";

let handler = async (m, { conn }) => {
    try {
        let msg = await m.reply('「❀」 Reiniciando el bot...');

        // Guardar el ID del mensaje para editarlo después del reinicio
        fs.writeFileSync('./restart-msg.json', JSON.stringify({
            chat: m.chat,
            msgId: msg.key.id
        }, null, 2));

        setTimeout(() => {
            process.exit(0);
        }, 2000);

    } catch (error) {
        console.log(error);
        conn.reply(m.chat, String(error), m);
    }
};

handler.help = ['restart'];
handler.tags = ['owner'];
handler.command = ['rei', 'restart'];
handler.rowner = true;

export default handler;