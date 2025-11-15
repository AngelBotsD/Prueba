import fs from 'fs'

let handler = async (m, { conn, args }) => {
  let userId = m.mentionedJid?.[0] || m.sender
  let user = global.db.data.users[userId]
  let name = conn.getName(userId)
  let _uptime = process.uptime() * 1000
  let uptime = clockString(_uptime)
  let totalreg = Object.keys(global.db.data.users).length

  let hour = new Intl.DateTimeFormat('es-PE', {
    hour: 'numeric',
    hour12: false,
    timeZone: 'America/Lima'
  }).format(new Date())

  let saludo =
    hour < 4  ? "🌌 Aún es de madrugada... las almas rondan 👻" :
    hour < 7  ? "🌅 El amanecer despierta... buenos inicios ✨" :
    hour < 12 ? "🌞 Buenos días, que la energía te acompañe 💫" :
    hour < 14 ? "🍽️ Hora del mediodía... ¡a recargar fuerzas! 🔋" :
    hour < 18 ? "🌄 Buenas tardes... sigue brillando como el sol 🌸" :
    hour < 20 ? "🌇 El atardecer pinta el cielo... momento mágico 🏮" :
    hour < 23 ? "🌃 Buenas noches... que los espíritus te cuiden 🌙" :
    "🌑 Es medianoche... los fantasmas susurran en la oscuridad 👀"

  let categories = {}
  for (let plugin of Object.values(global.plugins)) {
    if (!plugin.help || !plugin.tags) continue
    for (let tag of plugin.tags) {
      if (!categories[tag]) categories[tag] = []
      categories[tag].push(...plugin.help.map(cmd => `#${cmd}`))
    }
  }

  let decoEmojis = ['🌙', '👻', '🪄', '🏮', '📜', '💫', '😈', '🍡', '🔮', '🌸', '🪦', '✨']
  let emojiRandom = () => decoEmojis[Math.floor(Math.random() * decoEmojis.length)]

  let menuText = `
👋🏻 𝖧𝗈𝗅𝖺 @${userId.split('@')[0]} 𝖬𝗎𝖼𝗁𝗈 𝖦𝗎𝗌𝗍𝗈, 𝖬𝗂 𝖭𝗈𝗆𝖻𝗋𝖾 𝖾𝗌 *𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍*, 𝖤𝗌𝗉𝖾𝗋𝗈 𝖰𝗎𝖾 𝖳𝖾 𝖲𝖾𝖺 𝖣𝖾 𝖬𝗎𝖼𝗁𝖺 𝖴𝗍𝗂𝗅𝗂𝖽𝖺𝖽, 𝖦𝗋𝖺𝖼𝗂𝖺𝗌 𝖯𝗈𝗋 𝖲𝗎 𝖯𝗋𝖾𝖿𝖾𝗋𝖾𝗇𝖼𝗂𝖺 🏞️.

𝖳𝗂𝖾𝗆𝗉𝗈 𝖰𝗎𝖾 𝖤𝗁 𝖤𝗌𝗍𝖺𝖽𝗈 𝖠𝖼𝗍𝗂𝖼𝗈: ${uptime}

${saludo}
`.trim()

  for (let [tag, cmds] of Object.entries(categories)) {
    let tagName = tag.toUpperCase().replace(/_/g, ' ')
    let deco = emojiRandom()
    menuText += `

╭━ ${deco} ${tagName} ━╮
${cmds.map(cmd => `│ ▪️ ${cmd}`).join('\n')}
╰─━━━━━━━━━━━╯`
  }

  await conn.sendMessage(
    m.chat,
    {
      video: { url: "https://cdn.russellxz.click/a1fe9136.mp4" },
      caption: menuText,
      gifPlayback: true,

      // ← AQUÍ SE APLICA CORRECTAMENTE global.rcanal
      ...(global.rcanal || {}),

      contextInfo: {
        ...(global.rcanal?.contextInfo || {}),

        // ← AQUÍ SE AÑADE LA MENCIÓN REAL
        mentionedJid: [userId]
      }
    },
    { quoted: m }
  )
}

handler.help = ['menu']
handler.tags = ['main']
handler.command = ['menu', 'menú', 'help', 'ayuda']
handler.rcanal = true

export default handler

function clockString(ms) {
  let h = Math.floor(ms / 3600000)
  let m = Math.floor(ms / 60000) % 60
  let s = Math.floor(ms / 1000) % 60
  return `${h}h ${m}m ${s}s`
}