const handler = async (m, { conn, text }) => {
  if (!m.isGroup) return m.reply('Este comando solo funciona en grupos.')

  if (!text) return m.reply(
    'Escribe el mensaje de despedida que quieras establecer.\n\n' +
    'Puedes usar los siguientes placeholders:\n' +
    '@user → será reemplazado por el usuario que sale\n' +
    '@group → nombre del grupo\n' +
    '@desc → descripción del grupo'
  )

  let chat = global.db.data.chats[m.chat]
  chat.sBye = text

  m.reply(`✅ Mensaje de despedida actualizado:\n\n${text}`)
}

handler.command = /^setbye$/i
handler.help = ["setbye <texto>"]
handler.tags = ["group"]

export default handler