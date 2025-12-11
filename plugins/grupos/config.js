import fs from "fs"
import path from "path"
import axios from "axios"

let stickerPath = path.join(process.cwd(), "media", "grupo.webp")

async function ensureSticker() {
  if (!fs.existsSync(stickerPath)) {
    let { data } = await axios.get("https://cdn.russellxz.click/9b99dd72.webp", {
      responseType: "arraybuffer"
    })
    fs.mkdirSync(path.dirname(stickerPath), { recursive: true })
    fs.writeFileSync(stickerPath, Buffer.from(data))
  }
}

let handler = async (m, { conn }) => {
  await ensureSticker()

  let body = m.text?.toLowerCase() || ""
  if (!/(abrir|cerrar|open|close)/.test(body)) return

  let abrir = /(abrir|open)/.test(body)
  let mode = abrir ? "not_announcement" : "announcement"

  await conn.groupSettingUpdate(m.chat, mode)

  await conn.sendMessage(m.chat, {
    sticker: fs.readFileSync(stickerPath),
    quoted: m
  })

  await conn.sendMessage(m.chat, {
    react: { text: "✅", key: m.key }
  })
}

handler.help = ["𝖦𝗋𝗎𝗉𝗈 𝖠𝖻𝗋𝗂𝗋", "𝖦𝗋𝗎𝗉𝗈 𝖢𝖾𝗋𝗋𝖺𝗋"]
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"]
handler.customPrefix = /^(?:\.?grupo\s*(abrir|cerrar|open|close)|\.?(abrir|cerrar|open|close))$/i
handler.command = new RegExp();
handler.group = true;
handler.admin = true;
export default handler