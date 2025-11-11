let handler = async (m, { conn }) => {
  if (!m.isGroup)
    return conn.reply(m.chat, '⚠️ Este comando solo funciona en grupos.', m)

  const groupMetadata = await conn.groupMetadata(m.chat)
  const participants = groupMetadata.participants
  const mentions = participants.map(p => p.id)

  // Mapa de prefijos -> banderas
  const flags = {
    52: '🇲🇽', // México
    54: '🇦🇷', // Argentina
    56: '🇨🇱', // Chile
    57: '🇨🇴', // Colombia
    58: '🇻🇪', // Venezuela
    51: '🇵🇪', // Perú
    55: '🇧🇷', // Brasil
    34: '🇪🇸', // España
    1: '🇺🇸',  // USA / Canadá
    502: '🇬🇹', // Guatemala
    503: '🇸🇻', // El Salvador
    504: '🇭🇳', // Honduras
    505: '🇳🇮', // Nicaragua
    506: '🇨🇷', // Costa Rica
    507: '🇵🇦', // Panamá
    591: '🇧🇴', // Bolivia
    593: '🇪🇨', // Ecuador
    595: '🇵🇾', // Paraguay
    598: '🇺🇾'  // Uruguay
  }

  let message = '📢 *MENCIÓN GLOBAL*\n\n'

  for (const p of participants) {
    const number = p.id.split('@')[0]
    const prefix = number.replace('+', '').slice(0, 3) // detectar prefijo
    const flag =
      flags[prefix] ||
      flags[prefix.slice(0, 2)] ||
      '🏳️' // bandera genérica si no hay
    const name = groupMetadata.subject ? '' : ''
    message += `${flag} @${number}\n`
  }

  await conn.sendMessage(m.chat, { text: message.trim(), mentions }, { quoted: m })
}

handler.command = /^todos$/i
handler.group = true
export default handler