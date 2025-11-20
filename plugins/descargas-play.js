import axios from "axios"
import yts from "yt-search"
import fs from "fs"
import path from "path"
import ffmpeg from "fluent-ffmpeg"
import { promisify } from "util"
import { pipeline } from "stream"
import crypto from "crypto"

const streamPipe = promisify(pipeline)
const TMP_DIR = path.join(process.cwd(), "tmp")
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })

const SKY_BASE = process.env.API_BASE || "https://api-sky.ultraplus.click"
const SKY_KEY = process.env.API_KEY || "Russellxz"
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT) || 3
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB) || 99
const DOWNLOAD_TIMEOUT = Number(process.env.DOWNLOAD_TIMEOUT) || 60000

const pending = {}
const cache = {}
let activeDownloads = 0
const downloadQueue = []
const downloadTasks = {}

function safeUnlink(file) {
  try { file && fs.existsSync(file) && fs.unlinkSync(file) } catch {}
}

function fileSizeMB(filePath) {
  try { return fs.statSync(filePath).size / (1024 * 1024) } catch { return 0 }
}

function readHeader(file, length = 16) {
  try {
    const fd = fs.openSync(file, "r")
    const buf = Buffer.alloc(length)
    fs.readSync(fd, buf, 0, length, 0)
    fs.closeSync(fd)
    return buf
  } catch { return null }
}

function validCache(file, expectedSize = null) {
  if (!file || !fs.existsSync(file)) return false
  const size = fs.statSync(file).size
  if (size < 50 * 1024) return false
  if (expectedSize && size < expectedSize * 0.92) return false
  const hex = readHeader(file, 16)?.toString("hex")
  if (!hex) return false
  if (file.endsWith(".mp3") && !hex.startsWith("494433") && !hex.startsWith("fff")) return false
  if ((file.endsWith(".mp4") || file.endsWith(".m4a")) && !hex.includes("66747970")) return false
  return true
}

async function wait(ms) { return new Promise(res => setTimeout(res, ms)) }

async function queueDownload(task) {
  if (activeDownloads >= MAX_CONCURRENT) await new Promise(res => downloadQueue.push(res))
  activeDownloads++
  try { return await task() } finally { activeDownloads--; downloadQueue.length && downloadQueue.shift()() }
}

async function getSkyApiUrl(videoUrl, format, timeout = 20000, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const { data } = await axios.get(`${SKY_BASE}/api/download/yt.php`, {
        params: { url: videoUrl, format },
        headers: { Authorization: `Bearer ${SKY_KEY}` },
        timeout
      })
      const url = data?.data?.audio || data?.data?.video || data?.audio || data?.video || data?.url || data?.download
      if (url?.startsWith("http")) return url
    } catch {}
    if (i < retries) await wait(500 * (i + 1))
  }
  return null
}

async function probeRemote(url, timeout = 10000) {
  try {
    const res = await axios.head(url, { timeout, maxRedirects: 5 })
    return { ok: true, size: Number(res.headers["content-length"] || 0), headers: res.headers }
  } catch { return { ok: false } }
}

async function downloadWithResume(url, filePath, signal, start = 0) {
  const headers = start ? { Range: `bytes=${start}-` } : {}
  const res = await axios.get(url, { responseType: "stream", timeout: DOWNLOAD_TIMEOUT, headers, signal, maxRedirects: 5 })
  await streamPipe(res.data, fs.createWriteStream(filePath, { flags: start ? "a" : "w" }))
  return filePath
}

async function convertToMp3(inputFile) {
  const outFile = inputFile.replace(path.extname(inputFile), ".mp3")
  await new Promise((resolve, reject) => ffmpeg(inputFile).audioCodec("libmp3lame").audioBitrate("128k").format("mp3").on("end", resolve).on("error", reject).save(outFile))
  safeUnlink(inputFile)
  return outFile
}

function ensureTask(videoUrl) {
  if (!downloadTasks[videoUrl]) downloadTasks[videoUrl] = {}
  return downloadTasks[videoUrl]
}

async function startDownload(videoUrl, key, mediaUrl) {
  const tasks = ensureTask(videoUrl)
  if (tasks[key]?.status === "done") return tasks[key].file
  if (tasks[key]?.status === "downloading") return tasks[key].promise

  const ext = key.startsWith("audio") ? "mp3" : "mp4"
  const file = path.join(TMP_DIR, `${crypto.randomUUID()}_${key}.${ext}`)
  const controller = new AbortController()
  const info = { file, status: "downloading", controller, promise: null }

  info.promise = (async () => {
    try {
      const start = fs.existsSync(file) ? fs.statSync(file).size : 0
      const probe = await probeRemote(mediaUrl)
      const expectedSize = probe.ok && probe.size
      await queueDownload(() => downloadWithResume(mediaUrl, file, controller.signal, start))
      if (key.startsWith("audio") && path.extname(file) !== ".mp3") info.file = await convertToMp3(file)
      if (!validCache(info.file, expectedSize)) { safeUnlink(info.file); throw new Error("Archivo inválido") }
      if (fileSizeMB(info.file) > MAX_FILE_MB) { safeUnlink(info.file); throw new Error(`Archivo demasiado grande`) }
      info.status = "done"
      return info.file
    } catch (err) {
      if (["CanceledError","canceled"].includes(err?.name || err?.message)) { info.status="paused"; return info.file }
      info.status = "error"
      safeUnlink(info.file)
      throw err
    }
  })()

  tasks[key] = info
  return info.promise
}

async function sendFileToChat(conn, chatId, filePath, title, asDocument, type, quoted) {
  if (!validCache(filePath)) return await conn.sendMessage(chatId, { text: "❌ Archivo inválido." }, { quoted })
  const buffer = fs.readFileSync(filePath)
  await conn.sendMessage(chatId, { [asDocument ? "document" : type]: buffer, mimetype: type==="audio"?"audio/mpeg":"video/mp4", fileName:`${title}.${type==="audio"?"mp3":"mp4"}` }, { quoted })
}

async function handleDownload(conn, job, choice) {
  const map = { "👍":"audio","❤️":"video","📄":"audioDoc","📁":"videoDoc" }
  const key = map[choice]
  if (!key) return
  const type = key.startsWith("audio") ? "audio":"video"
  const isDoc = key.endsWith("Doc")
  const id = job.videoUrl
  const cached = cache[id]?.files?.[key]
  if (cached && validCache(cached)) return sendFileToChat(conn, job.chatId, cached, job.title, isDoc, type, job.commandMsg)

  const mediaUrl = await getSkyApiUrl(id, type)
  if (!mediaUrl) return await conn.sendMessage(job.chatId, { text:`❌ No se obtuvo enlace de ${type}` }, { quoted: job.commandMsg })

  const probe = await probeRemote(mediaUrl)
  if (!probe.ok || (probe.size && probe.size/(1024*1024)>MAX_FILE_MB)) return await conn.sendMessage(job.chatId, { text:`❌ Archivo muy grande o inaccesible` }, { quoted: job.commandMsg })

  try {
    await conn.sendMessage(job.chatId, { text:`⏳ Descargando ${type}...` }, { quoted: job.commandMsg })
    const f = await startDownload(id, key, mediaUrl)
    cache[id] = cache[id]||{timestamp:Date.now(), files:{}}
    cache[id].files[key]=f
    cache[id].timestamp=Date.now()
    await sendFileToChat(conn, job.chatId, f, job.title, isDoc, type, job.commandMsg)
  } catch(err) { await conn.sendMessage(job.chatId, { text:`❌ Error: ${err?.message||err}` }, { quoted: job.commandMsg }) }
}

const handler = async (msg, { conn, text, command }) => {
  const pref = global.prefixes?.[0]||"."
  if (command==="clean") {
    let deleted=0, freed=0
    Object.values(cache).forEach(data=>Object.values(data.files).forEach(f=>{ if(fs.existsSync(f)){freed+=fs.statSync(f).size; safeUnlink(f); deleted++}}))
    fs.readdirSync(TMP_DIR).forEach(f=>{ const full=path.join(TMP_DIR,f); if(fs.existsSync(full)){freed+=fs.statSync(full).size; safeUnlink(full); deleted++} })
    return await conn.sendMessage(msg.chat, { text:`🧹 Limpieza PRO\nEliminados: ${deleted}\nEspacio liberado: ${(freed/1024/1024).toFixed(2)} MB` }, { quoted: msg })
  }
  if(!text?.trim()) return await conn.sendMessage(msg.key.remoteJid, { text:`✳️ Usa:\n${pref}play <término>\nEj: ${pref}play bad bunny diles` }, { quoted: msg })

  try{ await conn.sendMessage(msg.key.remoteJid, { react:{text:"⏳", key:msg.key} }) } catch{}
  let res
  try{ res = await yts(text) } catch{ return await conn.sendMessage(msg.key.remoteJid, { text:"❌ Error al buscar video." }, { quoted: msg }) }
  const video=res.videos?.[0]
  if(!video) return await conn.sendMessage(msg.key.remoteJid, { text:"❌ Sin resultados." }, { quoted: msg })

  const { url:videoUrl, title, timestamp:duration, views, author, thumbnail } = video
  const caption = `𝚂𝚄𝙿𝙴𝚁 𝙿𝙻𝙰𝚈
🎵 Título: ${title}
🕑 Duración: ${duration}
👁️‍🗨️ Vistas: ${(views||0).toLocaleString()}
🎤 Artista: ${author?.name||author||"Desconocido"}
🌐 Link: ${videoUrl}

📥 Reacciona para descargar:
☛ 👍 Audio MP3
☛ ❤️ Video MP4
☛ 📄 Audio Doc
☛ 📁 Video Doc`.trim()

  const preview = await conn.sendMessage(msg.key.remoteJid, { image:{url:thumbnail}, caption }, { quoted: msg })
  pending[preview.key.id] = { chatId: msg.key.remoteJid, videoUrl, title, commandMsg: msg, sender: msg.key.participant||msg.participant, downloading:false }
  setTimeout(()=>delete pending[preview.key.id], 10*60*1000)
  try{ await conn.sendMessage(msg.key.remoteJid, { react:{text:"✅", key:msg.key} }) } catch{}

  if(!conn._listeners) conn._listeners={}
  if(!conn._listeners.play) {
    conn._listeners.play=true
    conn.ev.on("messages.upsert", async ev=>{
      for(const m of ev.messages||[]){
        const react=m.message?.reactionMessage
        if(!react) continue
        const { key:reactKey, text:emoji, sender }=react
        const job=pending[reactKey?.id]
        if(!job || !["👍","❤️","📄","📁"].includes(emoji)) continue
        if((sender||m.key.participant)!==job.sender){ await conn.sendMessage(job.chatId,{text:"❌ No autorizado."},{quoted:job.commandMsg}); continue }
        if(job.downloading) continue
        job.downloading=true
        try{ await handleDownload(conn, job, emoji) } finally{ job.downloading=false }
      }
    })
  }
}

handler.command=["play","clean"]
export default handler