import fs from "fs"

const DB_PATH = "./grupo-stickers.json"

function loadDB() {
  if (!fs.existsSync(DB_PATH)) return {}
  return JSON.parse(fs.readFileSync(DB_PATH))
}

function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2))
}

let handler = async (m, { conn }) => {
  const text = m.text?.trim().toLowerCase() || ""
  let action = text.match(/(abrir|cerrar|open|close)/)
  if (!action) return
  action = action[1]

  const db = loadDB()

  if (m.quoted?.mtype === "stickerMessage") {
    const file = await conn.download(m.quoted)
    const type = /abrir|open/.test(action) ? "abrir" : "cerrar"
    const filePath = `./sticker_${type}.webp`
    fs.writeFileSync(filePath, file)
    db[type] = filePath
    saveDB(db)
    await conn.sendMessage(m.chat, { text: `Sticker de ${type} actualizado correctamente.`, quoted: m })
    return
  }

  let mode = /abrir|open/.test(action)
    ? "not_announcement"
    : "announcement"

  await conn.groupSettingUpdate(m.chat, mode)

  let stickerPath = /abrir|open/.test(action)
    ? db.abrir
    : db.cerrar

  if (!stickerPath || !fs.existsSync(stickerPath)) {
    stickerPath = "https://cdn.russellxz.click/1f922165.webp"
  }

  await conn.sendMessage(m.chat, {
    sticker: { url: stickerPath },
    quoted: m
  })

  await conn.sendMessage(m.chat, {
    react: { text: "✅", key: m.key }
  })
}

handler.customPrefix = /^(?:\.?grupo\s*(abrir|cerrar|open|close)|\.?(abrir|cerrar|open|close))$/i
handler.command = new RegExp()
handler.group = true

export default handler