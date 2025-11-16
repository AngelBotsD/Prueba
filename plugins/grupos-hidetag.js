let handler = async (m, { sock }) => {
  try {
    if (!m.isGroup)
      return sock.sendMessage(m.chat, { text: '⚠️ Este comando solo funciona en grupos.' })

    // Obtener participantes (mencionar a todos)
    const group = await sock.groupMetadata(m.chat)
    const mentions = group.participants.map(p => p.id)

    // Obtener texto o caption
    let text =
      m.text ||
      m.message?.imageMessage?.caption ||
      m.message?.videoMessage?.caption ||
      ''

    // Limpiar comando .n
    const cleanText = text.replace(/^(\.n|n)\s*/i, '').trim()

    // 🟦 1. SI ESTÁS RESPONDIENDO A UN MENSAJE
    if (m.quoted) {
      await sock.sendMessage(m.chat, {
        forward: m.quoted.key,
        mentions
      })
      return
    }

    // 🟩 2. SI ES IMAGEN O VIDEO CON CAPTION
    if (m.message?.imageMessage || m.message?.videoMessage) {
      const type = m.message.imageMessage ? 'image' : 'video'
      const mediaObj = m.message.imageMessage || m.message.videoMessage

      // Volver a enviar el archivo (DS6 no admite relay)
      await sock.sendMessage(m.chat, {
        [type]: { url: mediaObj.url }, 
        caption: cleanText || 'Notificación',
        mentions
      })
      return
    }

    // 🟨 3. SI SOLO ES TEXTO
    if (cleanText.length > 0) {
      await sock.sendMessage(m.chat, {
        text: cleanText || 'Notificación',
        mentions
      })
      return
    }

    // Si no hay nada para reenviar
    await sock.sendMessage(m.chat, { text: '❌ No hay nada para reenviar.' })

  } catch (err) {
    console.log('Error en .n:', err)
    await sock.sendMessage(m.chat, { text: '⚠️ Error al reenviar: ' + err.message })
  }
}

// Prefijo
handler.customPrefix = /^(\.n|n)(\s|$)/i
handler.command = new RegExp()
handler.group = true
handler.admin = true

export default handler