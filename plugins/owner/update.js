import { execSync } from 'child_process'
let handler = async (m, { conn, text }) => {
await m.react('🕓')
if (conn.user.jid == conn.user.jid) {
let stdout = execSync('git pull' + (m.fromMe && text ? ' ' + text : ''))
await conn.reply(m.chat, stdout.toString(), m, rcanal)
await m.react('✅')
}}

handler.help = ["𝖴𝗉𝖽𝖺𝗍𝖾"]
handler.tags = ["𝖮𝖶𝖭𝖤𝖱"]
handler.command = ['update', 'actualizar', 'fix', 'fixed'] 
handler.rowner = true
export default handler