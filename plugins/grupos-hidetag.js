let handler = async (m, { conn }) => {
try {
if (!m.isGroup)
return conn.reply(m.chat, '⚠️ Este comando solo funciona en grupos.', m)

const groupMetadata = await conn.groupMetadata(m.chat)  
const mentions = groupMetadata.participants.map(p => p.id)  

let text =  
  m.text ||  
  m.msg?.caption ||  
  m.message?.imageMessage?.caption ||  
  m.message?.videoMessage?.caption ||  
  ''  

const cleanText = text.replace(/^\.?n(\s|$)/i, '').trim()  

// Si se cita un mensaje (.n respondiendo a algo)  
if (m.quoted) {  
  const quoted = m.quoted?.message  
    ? { key: m.quoted.key, message: m.quoted.message }  
    : m.quoted.fakeObj || m.quoted  

  await conn.sendMessage(  
    m.chat,  
    { forward: quoted, mentions },  
    { quoted: m }  
  )  
  return  
}  

// Si es imagen o video con caption  
if (m.message?.imageMessage || m.message?.videoMessage) {  
  const msg = JSON.parse(JSON.stringify(m))  
  const type = Object.keys(msg.message)[0]  
  msg.message[type].caption = cleanText || 'Notificación'  
  msg.message[type].contextInfo = { mentionedJid: mentions }  

  await conn.relayMessage(m.chat, msg.message, { messageId: m.key.id })  
  return  
}  

// Si solo es texto (.n o .n texto)  
if (text.length > 0) {  
  await conn.sendMessage(  
    m.chat,  
    {  
      text: cleanText || 'Notificación',  
      mentions  
    },  
    { quoted: m }  
  )  
  return  
}  

await conn.reply(m.chat, '❌ No hay nada para reenviar.', m)

} catch (err) {
console.error('Error en .n:', err)
await conn.reply(m.chat, '⚠️ Error al reenviar: ' + err.message, m)
}
}

handler.help = ["𝖭𝗈𝗍𝗂𝖿𝗒"];
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"];
handler.customPrefix = /^\.?n(\s|$)/i
handler.command = new RegExp()
handler.group = true
handler.admin = true
export default handler