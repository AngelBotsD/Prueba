const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid
  const ctx = msg.message?.extendedTextMessage?.contextInfo

  // Si no está respondiendo a un mensaje → solo reaccionamos ❓
  if (!ctx?.stanzaId) {
    await conn.sendMessage(chatId, {
      react: { text: "❓", key: msg.key }
    })
    return
  }

  try {
    // Eliminación DIRECTA — lo más rápido posible
    await conn.sendMessage(chatId, {
      delete: {
        remoteJid: chatId,
        fromMe: false,
        id: ctx.stanzaId,
        participant: ctx.participant
      }
    })

    // Reacción instantánea al mensaje que ejecutó el comando
    await conn.sendMessage(chatId, {
      react: { text: "✅", key: msg.key }
    })

  } catch (e) {
    console.error("Error al eliminar:", e)
    await conn.sendMessage(chatId, {
      react: { text: "❌", key: msg.key }
    })
  }
}

handler.help = ["𝖣𝖾𝗅𝖾𝗍𝖾"];
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"];
handler.customPrefix = /^\.?(del|delete)$/i;
handler.command = new RegExp();

export default handler