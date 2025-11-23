let handler = async (m, { conn, args, isAdmin, isOwner }) => {

  // Solo admins o dueños pueden usarlo
  if (!m.isGroup) {
    global.dfail('group', m, conn)
    throw false
  }
  if (!(isAdmin || isOwner)) {
    global.dfail('admin', m, conn)
    throw false
  }

  const option = (args[0] || '').toLowerCase()

  if (!['on', 'off', 'enable', 'disable', '1', '0'].includes(option)) {
    return m.reply(`
❌ *Uso incorrecto*

Ejemplos:
• *${m.prefix}modoadmin on*
• *${m.prefix}modoadmin off*
`)
  }

  const enable = /on|enable|1/i.test(option)

  const chat = global.db.data.chats[m.chat] ||= {}
  chat.modoadmin = enable

  m.reply(`🛡 *Modo Admin* ha sido ${enable ? 'activado' : 'desactivado'} correctamente.`)
}

handler.help = ['modoadmin on', 'modoadmin off']
handler.tags = ['group']
handler.command = /^modoadmin$/i

export default handler