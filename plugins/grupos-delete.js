const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid
  const ctx = msg.message?.extendedTextMessage?.contextInfo

  if (!ctx?.stanzaId) {
    await conn.sendMessage(chatId, {
      text: "Responde al mensaje que deseas eliminar."
    }, { quoted: msg })
    return
  }

  try {
    await conn.sendMessage(chatId, {
      delete: {
        remoteJid: chatId,
        fromMe: false,
        id: ctx.stanzaId,
        participant: ctx.participant
      }
    })

    await conn.sendMessage(chatId, {
      delete: {
        remoteJid: chatId,
        fromMe: msg.key.fromMe || false,
        id: msg.key.id,
        participant: msg.key.participant || undefined
      }
    })

  } catch (e) {
    console.error("Error al eliminar:", e)
    await conn.sendMessage(chatId, {
      text: "No se pudo eliminar el mensaje."
    }, { quoted: msg })
  }
}

handler.help = ["𝖣𝖾𝗅𝖾𝗍𝖾"];
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"];
handler.customPrefix = /^\.?(del|delete)$/i;
handler.command = new RegExp();
handler.group = true;
handler.admin = true;
export default handler