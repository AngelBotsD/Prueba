import fs from 'fs';
import path from 'path';

const restartFile = path.join('./restart.json');

let handler = async (m, { conn }) => {
    try {
        // Enviar mensaje de reinicio
        const sentMsg = await conn.sendMessage(m.chat, { text: '「🏜️」 Reiniciando El Bot....' });

        // Guardar info para editar después del reinicio
        fs.writeFileSync(restartFile, JSON.stringify({
            chat: m.chat,
            id: sentMsg.key.id
        }));

        setTimeout(() => process.exit(0), 3000);
    } catch (error) {
        console.log(error);
        conn.sendMessage(m.chat, { text: `${error}` });
    }
};

handler.help = ["𝖱𝖾𝗌𝗍𝖺𝗋𝗍"]
handler.tags = ["𝖮𝖶𝖭𝖤𝖱"]
handler.command = ['rei', 'restart'];
handler.rowner = true;

export default handler;