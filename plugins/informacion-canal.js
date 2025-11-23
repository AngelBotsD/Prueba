import fs from 'fs'
import path from 'path'

export async function before(m, { conn }) {
  try {

    let nombreBot = global.namebot || '𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍'
    let bannerFinal = 'https://cdn.russellxz.click/6f4329eb.jpeg'


    const botActual = conn.user?.jid?.split('@')[0].replace(/\D/g, '')
    const configPath = path.join('./𝖠𝗇𝗀𝖾𝗅𝖻𝗈𝗍𝗌', botActual, 'config.json')

    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath))
        if (config.name) nombreBot = config.name
        if (config.banner) bannerFinal = config.banner
      } catch (err) {
        console.log('⚠️ No se pudo leer config del subbot en rcanal:', err)
      }
    }


    const canales = [global.idcanal, global.idcanal2]
    const newsletterJidRandom = canales[Math.floor(Math.random() * canales.length)]


    global.rcanal = {
      contextInfo: {
        isForwarded: true,
        forwardingScore: 1,
        forwardedNewsletterMessageInfo: {
          newsletterJid: newsletterJidRandom,
          serverMessageId: 100,
          newsletterName: global.namecanal,
        },
        externalAdReply: {
          title: nombreBot,
          body: global.author,
          thumbnailUrl: bannerFinal,
          sourceUrl: null,
          mediaType: 1,
          renderLargerThumbnail: false
        }
      }
    }
  } catch (e) {
    console.log('Error al generar rcanal:', e)
  }
}