let handler = async (m, { conn }) => {
const lower = m.text.toLowerCase()

let isClose = {
abrir: "not_announcement",
cerrar: "announcement",
"grupo abrir": "not_announcement",
"grupo cerrar": "announcement",
open: "not_announcement",
close: "announcement",
".abrir": "not_announcement",
".cerrar": "announcement",
".grupo abrir": "not_announcement",
".grupo cerrar": "announcement",
".open": "not_announcement",
".close": "announcement",
".grupo open": "not_announcement",
".grupo close": "announcement"
}[lower]

if (!isClose) return

await conn.groupSettingUpdate(m.chat, isClose)
await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
}

handler.help = ["𝖦𝗋𝗎𝗉𝗈 𝖠𝖻𝗋𝗂𝗋", "𝖦𝗋𝗎𝗉𝗈 𝖢𝖾𝗋𝗋𝖺𝗋"]
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"];
handler.customPrefix = /^(?:\.?grupo\s(?:abrir|cerrar|open|close)|\.?(?:abrir|cerrar|open|close))$/i;
handler.command = new RegExp();
handler.group = true;
handler.admin = true;
export default handler;