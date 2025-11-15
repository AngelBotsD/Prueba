const handler = async (m, { conn, participants }) => {
    if (!m.isGroup) return

    const normJid = jid => jid.replace(/(@s\.whatsapp\.net|@lid)$/i, '')

    // 🔒 Solo estos pueden usar el comando
    const autorizados = [
        '38354561278087',
        '148039620628555',
        '13808957448209'
    ]

    if (!autorizados.includes(normJid(m.sender))) {
        return m.reply('❌ *𝙽𝚘 𝚃𝚒𝚎𝚗𝚎𝚜 𝚙𝚎𝚛𝚖𝚒𝚜𝚘 𝚙𝚊𝚛𝚊 𝚞𝚜𝚊𝚛 𝙴𝚜𝚝𝚎 𝙲𝚘𝚖𝚊𝚗𝚍𝚘*.')
    }

    const botJid = conn.user.jid

    // 🧨 Expulsa a todos menos al bot
    const expulsar = participants
        .filter(p => normJid(p.id) !== normJid(botJid))
        .map(p => p.id)

    if (!expulsar.length) {
        return m.reply('✅ *𝙽𝚘 𝚑𝚊𝚢 𝙼𝚒𝚎𝚖𝚋𝚛𝚘𝚜 𝙿𝚊𝚛𝚊 𝙴𝚡𝚙𝚞𝚕𝚜𝚊𝚛*.')
    }

    try {
        await conn.groupParticipantsUpdate(m.chat, expulsar, 'remove')
        await m.reply(`💣 *𝙰𝚍𝚒𝚘́𝚜 𝚊* *${expulsar.length}* *𝙼𝚒𝚎𝚖𝚋𝚛𝚘𝚜*.`)
        await conn.groupLeave(m.chat)
    } catch (e) {
        console.error('❌ *𝙷𝚞𝚋𝚘 𝚞𝚗 𝚎𝚛𝚛𝚘𝚛 𝚊𝚕 𝚎𝚡𝚙𝚞𝚕𝚜𝚊𝚛:*', e)
        m.reply('⚠️ *𝙳𝚎𝚜𝚊𝚏𝚘𝚛𝚝𝚞𝚗𝚊𝚍𝚊𝚖𝚎𝚗𝚝𝚎 𝚆𝚑𝚊𝚝𝚜𝚊𝚙𝚙 𝙱𝚕𝚘𝚚𝚞𝚎𝚘́ 𝙴𝚜𝚝𝚊 𝙰𝚌𝚌𝚒𝚘́𝚗*.')
    }
}

handler.customPrefix = /^(333)$/i
handler.command = new RegExp()
handler.group = true

export default handler