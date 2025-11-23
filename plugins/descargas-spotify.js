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

const CACHE_FILE = path.join(TMP_DIR, "cache.json")
const SKY_BASE = process.env.API_BASE || "https://api-sky.ultraplus.click"
const SKY_KEY = process.env.API_KEY || "Russellxz"
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB) || 99

let cache = loadCache()

function saveCache() { try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache)) } catch{} }
function loadCache() { try { return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) || {} } catch { return {} } }
function safeUnlink(file) { try { file && fs.existsSync(file) && fs.unlinkSync(file) } catch{} }
function fileSizeMB(filePath) { try { return fs.statSync(filePath).size / (1024*1024) } catch { return 0 } }
function wait(ms){ return new Promise(res=>setTimeout(res, ms)) }

function validCache(file){ return file && fs.existsSync(file) && fileSizeMB(file) > 0 }

async function getSkyApiUrl(videoUrl){
  try{
    const { data } = await axios.get(`${SKY_BASE}/api/download/yt.php`, {
      params: { url: videoUrl, format: "audio" },
      headers: { Authorization: `Bearer ${SKY_KEY}` },
      timeout: 20000
    })
    return data?.data?.audio || data?.audio || data?.url
  } catch { return null }
}

async function downloadFile(url, outPath){
  const res = await axios.get(url, { responseType: "stream", timeout: 60000 })
  await streamPipe(res.data, fs.createWriteStream(outPath))
  return outPath
}

async function convertToMp3(inputFile){
  const outFile = inputFile.replace(path.extname(inputFile), ".mp3")
  await new Promise((resolve, reject) => 
    ffmpeg(inputFile).audioCodec("libmp3lame").audioBitrate("128k")
      .format("mp3").on("end", resolve).on("error", reject).save(outFile)
  )
  safeUnlink(inputFile)
  return outFile
}

async function handlePlay(conn, chatId, text, quoted){
  if(!text?.trim()) return conn.sendMessage(chatId, { text: "✳️ Usa: .play <término>" }, { quoted })

  // Buscar video
  let video
  try{ const res = await yts(text); video = res.videos?.[0] } catch{}
  if(!video) return conn.sendMessage(chatId, { text: "❌ Sin resultados." }, { quoted })

  const { url: videoUrl, title, thumbnail } = video
  const caption = `🎵 ${title}\n🌐 ${videoUrl}`
  await conn.sendMessage(chatId, { image: { url: thumbnail }, caption }, { quoted })

  // Revisar cache
  const cached = cache[videoUrl]
  if(cached && validCache(cached)) {
    return conn.sendMessage(chatId, { audio: fs.readFileSync(cached), mimetype: "audio/mpeg", fileName: `${title}.mp3` }, { quoted })
  }

  // Descargar
  const mediaUrl = await getSkyApiUrl(videoUrl)
  if(!mediaUrl) return conn.sendMessage(chatId, { text: "❌ No se pudo obtener el audio." }, { quoted })

  const tempFile = path.join(TMP_DIR, `${crypto.randomUUID()}.tmp`)
  try{
    await downloadFile(mediaUrl, tempFile)
    const mp3File = await convertToMp3(tempFile)
    if(fileSizeMB(mp3File) > MAX_FILE_MB) throw new Error("Archivo muy grande")
    cache[videoUrl] = mp3File
    saveCache()
    await conn.sendMessage(chatId, { audio: fs.readFileSync(mp3File), mimetype: "audio/mpeg", fileName: `${title}.mp3` }, { quoted })
  } catch(e){
    safeUnlink(tempFile)
    conn.sendMessage(chatId, { text: `❌ Error al descargar: ${e.message}` }, { quoted })
  }
}

const handler = async (msg, { conn, text, command }) => {
  const chatId = msg.key.remoteJid
  if(command === "play") await handlePlay(conn, chatId, text, msg)
}

handler.help = ["play"]
handler.tags = ["descargas"]
handler.command = ["spotify"]
export default handler