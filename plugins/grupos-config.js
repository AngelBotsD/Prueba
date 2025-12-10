let estadoTovar = {}; // por chat

const handler = async (msg, { conn }) => {
  const chat = msg.key.remoteJid;
  const body = msg.text?.toLowerCase() || "";
  const isCmd = body.startsWith(".tovar");

  if (isCmd) {
    if (body.includes("abrir")) {
      estadoTovar[chat] = "abrir";

      await conn.groupSettingUpdate(chat, "not_announcement");

      await conn.sendMessage(chat, {
        text: "Grupo ABIERTO.\nAhora envía un sticker.",
        quoted: msg
      });

      return;
    }

    if (body.includes("cerrar")) {
      estadoTovar[chat] = "cerrar";

      await conn.groupSettingUpdate(chat, "announcement");

      await conn.sendMessage(chat, {
        text: "Grupo CERRADO.\nAhora envía un sticker.",
        quoted: msg
      });

      return;
    }

    await conn.sendMessage(chat, {
      text: "Comando inválido.\nUsa:\n.tovar abrir\n.tovar cerrar",
      quoted: msg
    });
    return;
  }

  const stickerMsg = msg.message?.stickerMessage;
  if (stickerMsg) {
    const modo = estadoTovar[chat];
    if (!modo) return;

    if (modo === "abrir") {
      await conn.sendMessage(chat, {
        text: "Sticker recibido (modo ABRIR).",
        quoted: msg
      });
    }

    if (modo === "cerrar") {
      await conn.sendMessage(chat, {
        text: "Sticker recibido (modo CERRAR).",
        quoted: msg
      });
    }

    delete estadoTovar[chat];
  }
};

handler.customPrefix = /^\.tovar/i;
handler.command = new RegExp();

export default handler;