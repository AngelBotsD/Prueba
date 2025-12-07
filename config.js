import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'
import { fileURLToPath } from 'url'

global.owner = ['38354561278087', '245573982662762','274135666176172']

global.mods = []
global.prems = []

global.emoji = '📎'
global.emoji2 = '🏞️'
global.namebot = '𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍'
global.redes = 'https://whatsapp.com/channel/0029VbAe8TMHgZWirR5n1Y1P'
global.botname = '𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍'
global.banner = 'https://cdn.russellxz.click/88dd19a7.jpeg'
global.packname = '𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍'
global.author = '𝖣𝖾𝗌𝖺𝗋𝗋𝗈𝗅𝗅𝖺𝖽𝗈 𝗉𝗈𝗋 𝖠𝗇𝗀𝖾𝗅'
global.libreria = 'Baileys'
global.baileys = 'V 6.7.16'
global.vs = '2.2.0'
global.usedPrefix = '.'
global.user2 = '18'
global.sessions = '𝖠𝗇𝗀𝖾𝗅𝖡𝗈𝗍'
global.jadi = 'Angelbots'
global.yukiJadibts = true

global.namecanal = '𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍 𝖣𝖾𝗌𝖺𝗋𝗋𝗈𝗅𝗅𝗈'
global.idcanal = '120363402177795471@newsletter'
global.idcanal2 = '120363402177795471@newsletter'
global.canal = 'https://whatsapp.com/channel/0029VbAe8TMHgZWirR5n1Y1P'
global.canalreg = '120363402177795471@newsletter'

global.ch = {
  ch1: '120363402177795471@newsletter'
}

global.multiplier = 69
global.maxwarn = 2

let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
  unwatchFile(file)
  console.log(chalk.redBright("Se actualizo el 'config.js'"))
  import(`file://${file}?update=${Date.now()}`)
})
