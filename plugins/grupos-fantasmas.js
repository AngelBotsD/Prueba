// ==========================
// 📌 REGISTRO DE MENSAJES
// ==========================
let messageHandler = async (m, { conn }) => {
    if (!m.isGroup) return
    if (!m.sender) return

    // Ignorar mensajes del bot
    if (m.sender === conn.user.jid) return

    // Ignorar mensajes del sistema que NO cuentan como actividad del usuario
    const ignorar = [
        "protocolMessage",
        "messageContextInfo"
    ]
    
    if (m.message) {
        let tipo = Object.keys(m.message)[0]
        if (ignorar.includes(tipo)) return
    }

    // Crear usuario si no existe
    if (!global.db.data.users[m.sender]) global.db.data.users[m.sender] = {}

    let userData = global.db.data.users[m.sender]

    // Crear objeto de grupos si no existe
    if (!userData.groups) userData.groups = {}

    // Crear registro del grupo si no existe
    if (!userData.groups[m.chat]) userData.groups[m.chat] = {}

    // Registrar última actividad REAL
    userData.groups[m.chat].lastMessage = Date.now()

    global.db.data.users[m.sender] = userData
}



// ==========================
// 📌 COMANDO: fantasmas / fankick
// ==========================
let handler = async (m, { conn, participants, command }) => {
    const DIAS = 3
    const INACTIVIDAD = DIAS * 24 * 60 * 60 * 1000
    const ahora = Date.now()

    let miembros = participants.map(v => v.id)
    let fantasmas = []

    for (let usuario of miembros) {

        // Ignorar al bot
        if (usuario === conn.user.jid) continue

        // Ignorar admins
        let p = participants.find(u => u.id === usuario)
        if (p?.admin || p?.isAdmin || p?.isSuperAdmin) continue

        let dataUser = global.db.data.users[usuario]
        let lastMsg = dataUser?.groups?.[m.chat]?.lastMessage || 0

        if (ahora - lastMsg >= INACTIVIDAD) {
            fantasmas.push(usuario)
        }
    }

    if (fantasmas.length === 0) {
        return conn.reply(m.chat, `*[❗INFO❗]* No hay fantasmas aquí.`, m)
    }

    // 🚮 Si el comando es fankick → eliminar
    if (command === 'fankick') {
        await conn.groupParticipantsUpdate(m.chat, fantasmas, 'remove')

        return conn.reply(
            m.chat,
            `*Fantasmas eliminados:*\n${fantasmas.map(v => '@' + v.split('@')[0]).join('\n')}`,
            null,
            { mentions: fantasmas }
        )
    }

    // 📋 Lista de fantasmas si NO es fankick
    let mensaje =
`[ ⚠ 𝙄𝙉𝘼𝘾𝙏𝙄𝙑𝙄𝘿𝘼𝘿 𝘿𝙀 𝟑 𝘿𝙄𝘼𝙎 ⚠ ]

Grupo: ${await conn.getName(m.chat)}
Miembros: ${miembros.length}

⇲ 𝙁𝘼𝙉𝙏𝘼𝙎𝙈𝘼𝙎 𝙄𝙉𝘼𝘾𝙏𝙄𝙑𝙊𝙎 ⇱
${fantasmas.map(v => '👻 @' + v.split('@')[0]).join('\n')}

🧹 *Usa .fankick para eliminarlos*`

    conn.reply(m.chat, mensaje, null, { mentions: fantasmas })
}


// ==========================
// 📌 Exportaciones
// ==========================
handler.help = ['fantasmas', 'fankick']
handler.tags = ['group']
handler.command = /^(fantasmas|verfantasmas|sider|fankick)$/i
handler.admin = true

export { messageHandler }
export default handler