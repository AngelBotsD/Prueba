let handler = async (m, { conn, usedPrefix, command }) => {

    try {
        m.reply('「🏜️」 Reiniciando El Bot....')
        setTimeout(() => {
            process.exit(0)
        }, 3000) 
    } catch (error) {
        console.log(error)
        conn.reply(m.chat, `${error}`, m)
    }
}


handler.help = ["𝖱𝖾𝗌𝗍𝖺𝗋𝗍"]
handler.tags = ["𝖮𝖶𝖭𝖤𝖱"]
handler.command = ['rei', 'restart'] 
handler.rowner = true

export default handler