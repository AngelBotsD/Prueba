const handler = async (m, { conn, isROwner, text }) => {
    try {
        const { key } = await conn.sendMessage(m.chat, { text: `🚀🚀` }, { quoted: m })
        await delay(1000)
        await conn.sendMessage(m.chat, { text: `🚀🚀🚀🚀`, edit: key })
        await delay(1000)
        await conn.sendMessage(m.chat, { text: `🚀🚀🚀🚀🚀🚀`, edit: key })
        await conn.sendMessage(m.chat, { text: `𝙍𝙚𝙞𝙣𝙞𝙘𝙞𝙖𝙧 | 𝙍𝙚𝙨𝙩𝙖𝙧𝙩`, edit: key })

        process.exit(0)

    } catch (error) {
        console.log(error)
        conn.reply(m.chat, `${error}`, m)
    }
}

handler.help = ['restart']
handler.tags = ['owner']
handler.command = ['res', 'reiniciar', 'restart']
handler.owner = true

export default handler

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))