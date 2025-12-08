import fs from 'fs/promises'
import path from 'path'

const OWNER_LID = ['245573982662762@lid', '274135666176172@lid']
const DB_PATH = path.resolve('./database')
const AUTOSAVE_INTERVAL = 10 * 1000

function normalizeRawJid(jid) {
  if (!jid) return jid
  jid = String(jid)
  jid = jid.replace(/:.*@/, '@')
  jid = jid.replace(/[\s\n\r]+/g, '')
  if (!/@/.test(jid)) return jid
  return jid.split('@')[0] + '@s.whatsapp.net'
}

async function ensureDbOnDisk() {
  try {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true })
    await fs.stat(DB_PATH)
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify({ users: {}, chats: {} }, null, 2))
  }
}

let db = { users: {}, chats: {} }
let dirty = false
let autosaveTimer = null

async function loadDb() {
  try {
    await ensureDbOnDisk()
    const txt = await fs.readFile(DB_PATH, 'utf8')
    db = JSON.parse(txt || '{}')
    if (!db.users) db.users = {}
    if (!db.chats) db.chats = {}
  } catch (e) {
    db = { users: {}, chats: {} }
    await saveDb()
  }
}

async function saveDb() {
  try {
    const tmp = DB_PATH + '.tmp'
    await fs.writeFile(tmp, JSON.stringify(db, null, 2))
    await fs.rename(tmp, DB_PATH)
    dirty = false
  } catch (e) {
    console.error('saveDb error', e)
  }
}

function scheduleAutosave() {
  if (autosaveTimer) return
  autosaveTimer = setInterval(() => {
    if (dirty) saveDb()
  }, AUTOSAVE_INTERVAL)
  process.once('exit', () => { if (dirty) saveDb() })
  process.once('SIGINT', () => { if (dirty) saveDb(); process.exit() })
  process.once('SIGTERM', () => { if (dirty) saveDb(); process.exit() })
}

function ensureStructures() {
  if (!db) db = { users: {}, chats: {} }
  if (!db.users) db.users = {}
  if (!db.chats) db.chats = {}
}

function markDirty() {
  dirty = true
}

function ensureUser(jid) {
  if (!jid) return
  if (!db.users[jid]) db.users[jid] = { name: null, groups: {} }
  return db.users[jid]
}

function ensureUserGroup(jid, chat) {
  const u = ensureUser(jid)
  if (!u.groups) u.groups = {}
  if (!u.groups[chat]) u.groups[chat] = { lastMessage: 0 }
  return u.groups[chat]
}

function now() {
  return Date.now()
}

function recordActivityFor(jid, chat, ts = Date.now(), pushName = null) {
  if (!jid || !chat) return
  const user = ensureUser(jid)
  if (pushName) user.name = pushName
  const g = ensureUserGroup(jid, chat)
  g.lastMessage = ts
  markDirty()
}

function jidToMentionText(jid) {
  if (!jid) return ''
  return jid.replace(/@.+/, '')
}

async function init() {
  await loadDb()
  ensureStructures()
  scheduleAutosave()
}

await init()

export async function messageHandler(upsert) {
  try {
    if (!upsert) return
    const ev = upsert
    const type = ev.type
    if (type !== 'notify' && type !== 'append') return
    const messages = ev.messages || ev
    for (const msg of messages) {
      if (!msg) continue
      const m = msg
      const remoteJid = m.key?.remoteJid || m.chat || null
      if (!remoteJid) continue
      if (!remoteJid.endsWith('@g.us')) continue
      const chat = remoteJid
      const botJid = normalizeRawJid(m.key?.fromMe ? m.key?.participant || m.key?.remoteJid : (m.key?.participant || m.key?.remoteJid))
      if (!m.key) continue
      let sender = m.key?.participant || m.sender || m.key?.remoteJid
      if (!sender) sender = m.participant || m.key?.participant
      if (!sender) continue
      sender = normalizeRawJid(sender)
      const pushName = m.pushName || (m.message?.senderKeyDistributionMessage && m.pushName) || null
      const ts = (m.messageTimestamp || m.message?.timestamp || Date.now()) * 1000 || Date.now()
      const typesToCount = [
        'conversation',
        'extendedTextMessage',
        'imageMessage',
        'videoMessage',
        'audioMessage',
        'stickerMessage',
        'documentMessage',
        'contactMessage',
        'contactsArrayMessage',
        'templateMessage',
        'buttonsResponseMessage',
        'listResponseMessage',
        'buttonMessage',
        'protocolMessage',
        'ephemeralMessage',
        'reactionMessage',
        'viewOnceMessage'
      ]
      const msgTypes = Object.keys(m.message || {})
      const msgType = msgTypes.length ? msgTypes[0] : null
      if (msgType && typesToCount.includes(msgType)) {
        recordActivityFor(sender, chat, ts, pushName)
      }
      if (m.message?.reactionMessage) {
        const who = normalizeRawJid(m.key?.participant || m.sender || sender)
        if (who && !OWNER_LID.includes(who)) recordActivityFor(who, chat, ts)
      }
      if (m.message?.messageContextInfo?.mentionedJid && Array.isArray(m.message.messageContextInfo.mentionedJid)) {
        for (let raw of m.message.messageContextInfo.mentionedJid) {
          const u = normalizeRawJid(raw)
          if (u && !OWNER_LID.includes(u)) recordActivityFor(u, chat, ts)
        }
      }
      if (m.message?.ephemeralMessage) {
        const inner = m.message.ephemeralMessage?.message
        if (inner) {
          const innerType = Object.keys(inner)[0]
          if (innerType && typesToCount.includes(innerType)) recordActivityFor(sender, chat, ts)
        }
      }
      if (!msgType && m.message && m.key && (m.key.fromMe === false || typeof m.key.fromMe === 'undefined')) {
        recordActivityFor(sender, chat, ts)
      }
    }
  } catch (e) {
    console.error('messageHandler error', e)
  }
}

export const handler = async (m, { conn, participants, command }) => {
  try {
    if (!m || !m.chat) return
    ensureStructures()
    const HORAS = 72
    const INACTIVIDAD = HORAS * 60 * 60 * 1000
    const ahora = now()
    if (!participants || !Array.isArray(participants)) {
      const metadata = await conn.groupMetadata(m.chat).catch(() => null)
      if (!metadata) return conn.sendMessage(m.chat, { text: 'No pude obtener participantes.' }, { quoted: m })
      participants = metadata.participants || []
    }
    const miembrosRaw = participants.map(p => p.id || p.jid || p)
    let fantasmas = []
    for (let raw of miembrosRaw) {
      const realJid = raw
      const usuario = normalizeRawJid(realJid)
      if (!usuario) continue
      if (usuario === normalizeRawJid(conn.user?.jid)) continue
      if (OWNER_LID.includes(usuario)) continue
      const p = participants.find(u => (u.id || u.jid || u) === realJid)
      const isAdmin = !!(p?.admin || p?.isAdmin || p?.isSuperAdmin)
      if (isAdmin) continue
      const last = db.users[usuario]?.groups?.[m.chat]?.lastMessage || 0
      if (!last || ahora - last >= INACTIVIDAD) fantasmas.push(realJid)
    }
    fantasmas = [...new Set(fantasmas)]
    if (!fantasmas.length) return conn.sendMessage(m.chat, { text: '✨ No hay fantasmas en este grupo.' }, { quoted: m })
    if (command === 'fankick') {
      try {
        const toRemove = fantasmas.filter(u => normalizeRawJid(u) !== normalizeRawJid(conn.user?.jid) && !OWNER_LID.includes(normalizeRawJid(u)))
        if (!toRemove.length) return conn.sendMessage(m.chat, { text: 'No hay participantes removibles en la lista.' }, { quoted: m })
        await conn.groupParticipantsUpdate(m.chat, toRemove, 'remove')
        const msg = toRemove.map(v => `🔥 @${jidToMentionText(v)}`).join('\n')
        return conn.sendMessage(m.chat, { text: `🔥 Fantasmas eliminados:\n${msg}`, mentions: toRemove }, { quoted: m })
      } catch (e) {
        return conn.sendMessage(m.chat, { text: 'No pude expulsar a algunos participantes.' }, { quoted: m })
      }
    }
    const lista = fantasmas.map(v => `👻 @${jidToMentionText(v)}`).join('\n')
    const texto = `👻 FANTASMAS DETECTADOS (72H)\n\nGrupo: ${await conn.getName(m.chat)}\n\n${lista}\n\nUsa .fankick para expulsarlos.`
    return conn.sendMessage(m.chat, { text: texto, mentions: fantasmas }, { quoted: m })
  } catch (e) {
    console.error('handler.fantasmas error', e)
  }
}

handler.command = /^(fantasmas|sider|verfantasmas|fankick)$/i
handler.admin = true

export function initAutoFantasma(conn) {
  if (!conn) throw new Error('initAutoFantasma necesita conn')
  if (global.autoFantasmaIniciado) return
  global.autoFantasmaIniciado = true
  const INTERVAL_MS = 24 * 60 * 60 * 1000
  setInterval(async () => {
    try {
      ensureDbOnDisk()
      ensureStructures()
      const chats = Object.keys(db.chats || {})
      for (let id of chats) {
        const chatCfg = db.chats[id]
        if (!chatCfg || !chatCfg.autoFantasma) continue
        const metadata = await conn.groupMetadata(id).catch(() => null)
        if (!metadata) continue
        const participants = metadata.participants || []
        const HORAS = 72
        const INACTIVIDAD = HORAS * 60 * 60 * 1000
        const ahora = now()
        let fantasmas = []
        for (let p of participants) {
          const real = p.id
          const u = normalizeRawJid(real)
          if (!u) continue
          if (u === normalizeRawJid(conn.user?.jid)) continue
          if (OWNER_LID.includes(u)) continue
          const isAdmin = !!(p?.admin || p?.isAdmin || p?.isSuperAdmin)
          if (isAdmin) continue
          const last = db.users[u]?.groups?.[id]?.lastMessage || 0
          if (!last || ahora - last >= INACTIVIDAD) fantasmas.push(real)
        }
        fantasmas = [...new Set(fantasmas)]
        if (!fantasmas.length) continue
        const lista = fantasmas.map(v => `👻 @${jidToMentionText(v)}`).join('\n')
        const texto = `👻 AUTO-REVISIÓN DE FANTASMAS (72H)\n\nGrupo: ${await conn.getName(id)}\n\n${lista}`
        await conn.sendMessage(id, { text: texto, mentions: fantasmas })
      }
    } catch (err) {
      console.error('autoFantasma error', err)
    }
  }, INTERVAL_MS)
}