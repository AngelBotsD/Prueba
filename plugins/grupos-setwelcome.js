const handler = async (m, { conn, text }) => {
  if (!m.isGroup) return m.reply('Este comando solo funciona en grupos.')

  if (!text) return m.reply(
    'Escribe el mensaje de bienvenida que quieras establecer.\n\n' +
    'Puedes usar los siguientes placeholders:\n' +
    '@user → será reemplazado por el usuario que entra\n' +
    '@group → nombre del grupo\n' +
    '@desc → descripción del grupo'
  )

  let chat = global.db.data.chats[m.chat]
  chat.sWelcome = text

  m.reply(`✅ Mensaje de bienvenida actualizado:\n\n${text}`)
}

handler.command = /^setwelcome$/i
handler.help = ["setwelcome <texto>"]
handler.tags = ["group"]

export default handler