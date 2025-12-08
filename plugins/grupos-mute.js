import fetch from 'node-fetch'
import fs from 'fs/promises'

const OWNER_LID = ['245573982662762@lid', '274135666176172@lid']
const DB_DIR = './database'
const DATA_FILE = `${DB_DIR}/muted.json`

if (!await fs.stat(DB_DIR).catch(() => false)) await fs.mkdir(DB_DIR)
if (!await fs.stat(DATA_FILE).catch(() => false)) await fs.writeFile(DATA_FILE, JSON.stringify({}, null, 2))

let mutedData
try {
    mutedData = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'))
} catch {
    mutedData = {}
    await fs.writeFile(DATA_FILE, JSON.stringify(mutedData, null, 2))
}

const saveMutedData = async () => {
    for (const [chat, list] of Object.entries(mutedData))
        if (!Array.isArray(list) || !list.length) delete mutedData[chat]
    await fs.writeFile(DATA_FILE, JSON.stringify(mutedData, null, 2))
}

const THUMB_CACHE = {}
async function getThumb(url) {
    if (THUMB_CACHE[url]) return THUMB_CACHE[url]
    try {
        const buf = await (await fetch(url)).buffer()
        THUMB_CACHE[url] = buf
        return buf
    } catch { return null }
}

let handler = async (m, { conn, command, isAdmin }) => {
    const user = m.quoted?.sender || m.mentionedJid?.[0]
    const sender = m.sender

    if (!user) return m.reply('⚠️ Usa: *.mute @usuario* o responde a su mensaje.')
    if (user === sender) return m.reply('❌ No puedes mutearte a ti mismo.')
    if (user === conn.user.jid) return m.reply('🤖 No puedes mutear al bot.')
    if (OWNER_LID.includes(user)) return m.reply('👑 No puedes mutear a un LID/Owner.')

    if (!(isAdmin || OWNER_LID.includes(sender))) return

    const imgUrl = command === 'mute'
        ? 'https://telegra.ph/file/f8324d9798fa2ed2317bc.png'
        : 'https://telegra.ph/file/aea704d0b242b8c41bf15.png'

    const thumb = await getThumb(imgUrl)

    const preview = {
        key: { fromMe: false, participant: '0@s.whatsapp.net', remoteJid: m.chat },
        message: { locationMessage: { name: command === 'mute' ? 'Usuario muteado' : 'Usuario desmuteado', jpegThumbnail: thumb } }
    }

    if (!mutedData[m.chat]) mutedData[m.chat] = []

    let name = 'Usuario'
    try { name = await conn.getName(user) } catch {}

    if (command === 'mute') {
        if (mutedData[m.chat].includes(user)) return
        mutedData[m.chat].push(user)
        await saveMutedData()
        await conn.sendMessage(m.chat, { text: `🔇 *${name}* fue muteado.`, mentions: [user] }, { quoted: preview })
    } else {
        if (!mutedData[m.chat].includes(user)) return
        mutedData[m.chat] = mutedData[m.chat].filter(u => u !== user)
        if (!mutedData[m.chat].length) delete mutedData[m.chat]
        await saveMutedData()
        await conn.sendMessage(m.chat, { text: `🔊 *${name}* fue desmuteado.`, mentions: [user] }, { quoted: preview })
    }
}

handler.before = async (m, { conn, isCommand }) => {
    if (!m.isGroup) return
    if (m.fromMe) return
    if (OWNER_LID.includes(m.sender)) return

    const mutedList = mutedData[m.chat]
    if (!mutedList || !mutedList.includes(m.sender)) return

    if (isCommand) return false

    return await conn.sendMessage(m.chat, { delete: m.key }).catch(() => {})
}

handler.all = async (m) => {
    if (!m.isGroup) return
    if (m.fromMe || OWNER_LID.includes(m.sender)) return
    const mutedList = mutedData[m.chat]
    if (mutedList && mutedList.includes(m.sender)) return false
}

handler.help = ["𝖬𝗎𝗍𝖾", "𝖴𝗇𝗆𝗎𝗍𝖾"]
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"]
handler.command = /^(mute|unmute)$/i
handler.group = true
handler.admin = true

export default handler