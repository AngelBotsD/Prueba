import fs from "fs";
import path from "path";

let handler = async (m, { conn }) => {
    try {
        // Guardamos el mensaje a editar
        const tempFile = path.join("./", "last-restart.json");
        fs.writeFileSync(tempFile, JSON.stringify({
            chat: m.chat,
            msgId: m.key.id
        }));

        await conn.reply(m.chat, '「❀」 Reiniciando el bot...', m);

        // Reiniciar en 3 segundos
        setTimeout(() => {
            process.exit(0);
        }, 3000);

    } catch (e) {
        console.log(e);
        conn.reply(m.chat, `${e}`, m);
    }
};

handler.help = ["restart"];
handler.tags = ["owner"];
handler.command = ["rei", "restart"];
handler.rowner = true;

export default handler;