let toM = a => '@' + a.split('@')[0]

function handler(m, { groupMetadata, conn }) {
    let ps = groupMetadata.participants.map(v => v.id)
    ps = ps.filter(id => id !== conn.user.jid)
    if (ps.length < 2) return m.reply('No hay suficientes participantes para formar pareja 😅')
    const getRandom = arr => arr[Math.floor(Math.random() * arr.length)]
    let a = getRandom(ps)
    let b
    do b = getRandom(ps)
    while (b === a)
    m.reply(`*${toM(a)}, 𝙳𝙴𝙱𝙴𝚁𝙸𝙰𝚂 𝙲𝙰𝚂𝙰𝚁𝚃𝙴 💍 𝙲𝙾𝙽 ${toM(b)}, 𝙷𝙰𝙲𝙴𝙽 𝚄𝙽𝙰 𝙱𝚄𝙴𝙽𝙰 𝙿𝙰𝚁𝙴𝙹𝙰 🤭*`, null, {
        mentions: [a, b]
    })
}

handler.help = ['formarpareja']
handler.tags = ['fun']
handler.command = ['formarpareja','formarparejas']
handler.group = true
export default handler