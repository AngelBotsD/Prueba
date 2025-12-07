import fs from "fs"
import path from "path"
import { exec as _exec } from "child_process"
import { promisify } from "util"
const exec = promisify(_exec)

let handler = async (m, { conn }) => {
  if (!m.quoted) return m.reply("⚠️ Responde a un sticker animado.")
  if (!/sticker/.test(m.quoted.mtype)) return m.reply("⚠️ Eso no es un sticker.")

  try {
    const media = await m.quoted.download()
    const input = path.join(process.cwd(), `input_${Date.now()}.webp`)
    const output = path.join(process.cwd(), `output_${Date.now()}.mp4`)

    await fs.promises.writeFile(input, media)

    // 🔥 Conversión directa WEBP animado → MP4
    await exec(`ffmpeg -i "${input}" -vf "scale=720:-1:flags=lanczos" -movflags +faststart -pix_fmt yuv420p "${output}"`)

    await conn.sendMessage(m.chat, { video: fs.readFileSync(output) }, { quoted: m })

    // limpiar archivos
    fs.unlinkSync(input)
    fs.unlinkSync(output)

  } catch (e) {
    console.error(e)
    m.reply("❌ Error al convertir el sticker.")
  }
}

handler.command = ["deswebp", "sticker2video", "tovideo"]
export default handler