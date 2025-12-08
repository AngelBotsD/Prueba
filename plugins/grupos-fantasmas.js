const OWNER_LID = ['245573982662762@lid', '274135666176172@lid']

function cleanJid(jid) {
  if (!jid) return jid
  jid = String(jid)
  jid = jid.replace(/:.*@/, '@')
  jid = jid.replace(/[\s\n\r]+/g, '')
  if (!/@/.test(jid)) return jid
  return jid.split('@')[0] + '@s.whatsapp.net'
}

function ensureDB() {
  if (!global.db) global.db = {}
  if (!global.db.data) global.db.data = {}
  if (!global.db.data.users) global.db.data.users = {}
  if (!global.db.data.chats) global.db.data.chats = {}
}

export async function messageHandler(m, { conn }) {
  try {
    if (!m) return
    ensureDB()

    const jid = m.key?.remoteJid || m.chat
    if (!jid || !jid.endsWith('@g.us')) return

    if (!m.sender && m.key?.participant) m.sender = m.key.participant
    if (!m.sender) return

    const sender = cleanJid(m.sender)
    const botJid = cleanJid(conn.user?.jid)
    if (!sender || sender === botJid) return

    if (!global.db.data.users[sender]) global.db.data.users[sender] = { name: null, groups: {} }
    if (!global.db.data.chats[jid]) global.db.data.chats[jid] = {}

    const now = Date.now()

    if (!global.db.data.users[sender].groups) global.db.data.users[sender].groups = {}
    if (!global.db.data.users[sender].groups[jid]) global.db.data.users[sender].groups[jid] = {}

    const pushName = m.pushName || (m.message?.senderKeyDistributionMessage && m.pushName) || null
    if (pushName) global.db.data.users[sender].name = pushName

    const typesToCount = [
      'conversation',
      'extendedTextMessage',
      'imageMessage',
      'videoMessage',
      'audioMessage',
      'stickerMessage',
      'documentMessage',
      'contactsArrayMessage',
      'contactsArray',
      'contactMessage',
      'templateMessage',
      'buttonsResponseMessage',
      'listResponseMessage',
      'buttonMessage',
      'buttonsMessage',
      'protocolMessage',
      'ephemeralMessage',
      'reactionMessage',
      'viewOnceMessage'
    ]

    const msgTypes = Object.keys(m.message || {})
    const type = msgTypes.length ? msgTypes[0] : null

    let counted = false

    if (type && typesToCount.includes(type)) {
      global.db.data.users[sender].groups[jid].lastMessage = now
      counted = true
    }

    if (m.message?.reactionMessage) {
      const who = cleanJid(m.key?.participant || m.sender)
      if (who && who !== botJid) {
        if (!global.db.data.users[who]) global.db.data.users[who] = { name: null, groups: {} }
        if (!global.db.data.users[who].groups) global.db.data.users[who].groups = {}
        if (!global.db.data.users[who].groups[jid]) global.db.data.users[who].groups[jid] = {}
        global.db.data.users[who].groups[jid].lastMessage = now
      }
      counted = true
    }

    if (m.message?.messageContextInfo?.mentionedJid && Array.isArray(m.message.messageContextInfo.mentionedJid)) {
      for (let raw of m.message.messageContextInfo.mentionedJid) {
        const u = cleanJid(raw)
        if (!u || u === botJid) continue
        if (!global.db.data.users[u]) global.db.data.users[u] = { name: null, groups: {} }
        if (!global.db.data.users[u].groups) global.db.data.users[u].groups = {}
        if (!global.db.data.users[u].groups[jid]) global.db.data.users[u].groups[jid] = {}
        global.db.data.users[u].groups[jid].lastMessage = now
      }
      counted = true
    }

    if (m.message?.ephemeralMessage) {
      const inner = m.message.ephemeralMessage?.message
      if (inner) {
        const innerType = Object.keys(inner)[0]
        if (innerType && typesToCount.includes(innerType)) {
          global.db.data.users[sender].groups[jid].lastMessage = now
          counted = true
        }
      }
    }

    if (!counted && m.message && m.key && (m.key.fromMe === false || typeof m.key.fromMe === 'undefined')) {
      global.db.data.users[sender].groups[jid].lastMessage = now
    }
  } catch (err) {
    console.error('[messageHandler] error', err)
  }
}

let handler = async (m, { conn, participants, command }) => {
  try {
    ensureDB()

    const HORAS = 72
    const INACTIVIDAD = HORAS * 60 * 60 * 1000
    const ahora = Date.now()

    if (!global.db.data.chats[m.chat]) global.db.data.chats[m.chat] = {}

    if (!participants || !Array.isArray(participants)) {
      const metadata = await conn.groupMetadata(m.chat).catch(() => null)
      if (!metadata) return conn.reply(m.chat, 'No pude obtener participantes.', m)
      participants = metadata.participants
    }

    const miembros = participants.map(v => cleanJid(v.id || v.jid || v))
    let fantasmas = []

    for (let usuario of miembros) {
      if (!usuario) continue
      if (usuario === cleanJid(conn.user?.jid)) continue
      if (OWNER_LID.includes(usuario)) continue

      const p = participants.find(u => cleanJid(u.id || u.jid || u) === usuario)
      const isAdmin = !!(p?.admin || p?.isAdmin || p?.isSuperAdmin)
      if (isAdmin) continue

      const dataUser = global.db.data.users[usuario]
      const lastMsg = dataUser?.groups?.[m.chat]?.lastMessage || 0

      if (!lastMsg || ahora - lastMsg >= INACTIVIDAD) fantasmas.push(usuario)
    }

    fantasmas = [...new Set(fantasmas)]

    if (!fantasmas.length) return conn.reply(m.chat, '✨ No hay fantasmas en este grupo.', m)

    if (command === 'fankick') {
      try {
        const toRemove = fantasmas.filter(u => u !== cleanJid(conn.user?.jid) && !OWNER_LID.includes(u))
        if (!toRemove.length) return conn.reply(m.chat, 'No hay participantes removibles en la lista.', m)
        await conn.groupParticipantsUpdate(m.chat, toRemove, 'remove')
        const msg = toRemove.map(v => {
          const data = global.db.data.users[v]
          const nombre = data?.name || v.split('@')[0]
          return `🔥 @${nombre}`
        }).join('\n')
        return conn.reply(m.chat, `🔥 Fantasmas eliminados:\n${msg}`, m, { mentions: toRemove })
      } catch (e) {
        return conn.reply(m.chat, 'No pude expulsar a algunos participantes.', m)
      }
    }

    const lista = fantasmas.map(v => {
      const data = global.db.data.users[v]
      const nombre = data?.name || v.split('@')[0]
      return `👻 @${nombre}`
    }).join('\n')

    const msg = `👻 FANTASMAS DETECTADOS (72H)\n\nGrupo: ${await conn.getName(m.chat)}\n\n${lista}\n\nUsa .fankick para expulsarlos.`
    conn.reply(m.chat, msg, m, { mentions: fantasmas })
  } catch (err) {
    console.error('[handler.fantasmas] error', err)
  }
}

handler.command = /^(fantasmas|sider|verfantasmas|fankick)$/i
handler.admin = true

export default handler

export function initAutoFantasma(conn) {
  if (!conn) throw new Error('initAutoFantasma necesita conn')
  if (global.autoFantasmaIniciado) return
  global.autoFantasmaIniciado = true
  const INTERVAL_MS = 24 * 60 * 60 * 1000
  setInterval(async () => {
    try {
      ensureDB()
      const chats = Object.keys(global.db.data.chats || {})
      for (let id of chats) {
        const chat = global.db.data.chats[id]
        if (!chat?.autoFantasma) continue
        const metadata = await conn.groupMetadata(id).catch(() => null)
        if (!metadata) continue
        const participants = metadata.participants || []
        const HORAS = 72
        const INACTIVIDAD = HORAS * 60 * 60 * 1000
        const ahora = Date.now()
        let fantasmas = []
        for (let raw of participants.map(v => v.id || v.jid || v)) {
          const u = cleanJid(raw)
          if (!u) continue
          if (u === cleanJid(conn.user?.jid)) continue
          if (OWNER_LID.includes(u)) continue
          const p = participants.find(x => cleanJid(x.id || x.jid || x) === u)
          const isAdmin = !!(p?.admin || p?.isAdmin || p?.isSuperAdmin)
          if (isAdmin) continue
          const dataUser = global.db.data.users[u]
          const lastMsg = dataUser?.groups?.[id]?.lastMessage || 0
          if (!lastMsg || ahora - lastMsg >= INACTIVIDAD) fantasmas.push(u)
        }
        if (!fantasmas.length) continue
        fantasmas = [...new Set(fantasmas)]
        const lista = fantasmas.map(v => {
          const data = global.db.data.users[v]
          const nombre = data?.name || v.split('@')[0]
          return `👻 @${nombre}`
        }).join('\n')
        const msg = `👻 AUTO-REVISIÓN DE FANTASMAS (72H)\n\nGrupo: ${await conn.getName(id)}\n\n${lista}`
        await conn.sendMessage(id, { text: msg, mentions: fantasmas })
      }
    } catch (err) {
      console.error('[autoFantasma] error', err)
    }
  }, INTERVAL_MS)
}