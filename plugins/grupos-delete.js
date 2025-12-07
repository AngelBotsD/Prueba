import fs from "fs"
import path from "path"

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid

  if (!msg.message?.extendedTextMessage?.contextInfo?.stanzaId) {
    await conn.sendMessage(chatId, {
      text: "❓ *Debes responder al mensaje que deseas eliminar con el comando `.delete`.*"
    }, { quoted: msg })
    return
  }

  const { stanzaId, participant } = msg.message.extendedTextMessage.contextInfo

  try {
    await conn.sendMessage(chatId, {
      delete: {
        remoteJid: chatId,
        fromMe: false,
        id: stanzaId,
        participant
      }
    })

    // ✔ Reacción al mensaje del usuario
    await conn.sendMessage(chatId, {
      react: {
        text: "✅",
        key: msg.key
      }
    })

  } catch (e) {
    console.error("❌ Error al eliminar mensaje:", e)
    await conn.sendMessage(chatId, {
      text: "❌ *No se pudo eliminar el mensaje.*"
    }, { quoted: msg })
  }
}

handler.help = ["𝖣𝖾𝗅𝖾𝗍𝖾"];
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"];
handler.customPrefix = /^\.?(del|delete)$/i;
handler.command = new RegExp();

export default handler