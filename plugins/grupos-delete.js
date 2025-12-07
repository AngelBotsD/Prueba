const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid
  const ctx = msg.message?.extendedTextMessage?.contextInfo

  // Si NO está respondiendo al mensaje a borrar
  if (!ctx?.stanzaId) {
    await conn.sendMessage(chatId, {
      text: "Responde al mensaje que deseas eliminar."
    }, { quoted: msg })
    return
  }

  try {
    // ELIMINAR el mensaje objetivo
    await conn.sendMessage(chatId, {
      delete: {
        remoteJid: chatId,
        fromMe: false,
        id: ctx.stanzaId,
        participant: ctx.participant
      }
    })

    // ELIMINAR el mensaje del usuario que ejecutó el comando
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

handler.customPrefix = /^\.?(del|delete)$/i
handler.command = new RegExp()

export default handler