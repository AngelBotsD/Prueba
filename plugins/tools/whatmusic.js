import acrcloud from 'acrcloud'
import yts from 'yt-search'
import fetch from 'node-fetch'
import crypto from 'crypto'

global.whatMusicCache = global.whatMusicCache || new Map()

let acr = new acrcloud({
  host: 'identify-eu-west-1.acrcloud.com',
  access_key: 'c33c767d683f78bd17d4bd4991955d81',
  access_secret: 'bvgaIAEtADBTbLwiPGYlxupWqkNGIjT7J9Ag2vIu'
})

let handler = async (m, { conn, usedPrefix, command }) => {
  try {
    await conn.sendMessage(m.chat, { react: { text: "🕒", key: m.key } })

    const q = m.quoted ? m.quoted : m
    const mime = (q.msg || q).mimetype || q.mediaType || ''
    if (!/audio|video/.test(mime)) {
      return conn.reply(m.chat, `Etiqueta un audio o video con ${usedPrefix + command}`, m)
    }

    const buffer = await q.download?.()
    if (!buffer) return conn.reply(m.chat, 'No pude descargar el archivo.', m)

    const duration = q.seconds || 0
    if (duration > 240) {
      return conn.reply(m.chat, `El archivo solo puede durar 3 minutos máximo. El tuyo dura ${duration}s.`, m)
    }

    const hash = crypto.createHash('sha256').update(buffer).digest('hex')

    if (whatMusicCache.has(hash)) {
      const data = whatMusicCache.get(hash)
      return conn.sendMessage(m.chat, data.msg, { quoted: m })
    }

    let result
    try {
      result = await acr.identify(buffer)
    } catch {
      return conn.reply(m.chat, `Error con ACRCloud.`, m)
    }

    if (!result?.status || result.status.code !== 0)
      return conn.reply(m.chat, `${result?.status?.msg || 'Error desconocido.'}`, m)

    const music = result.metadata.music?.[0]
    if (!music)
      return conn.reply(m.chat, 'No se pudo identificar la música.', m)

    const { title, artists, album, genres, release_date } = music
    const artistName = artists?.[0]?.name || ''
    let ytQuery = `${title} ${artistName}`.trim()

    let searchResults = await yts.search(ytQuery).catch(() => null)
    if (!searchResults?.videos?.length || searchResults.videos[0].views < 1000) {
      searchResults = await yts.search(title).catch(() => null)
    }

    const videos = (searchResults?.videos || []).filter(v =>
      v.views > 500 && v.duration.seconds < 600
    )

    let txt = `┏╾❑「 Whatmusic Tools 」\n`
    txt += `┃  Título: ${title || 'Desconocido'}\n`
    txt += `┃  Artista: ${artists?.map(v => v.name).join(', ') || 'Desconocido'}\n`
    if (album) txt += `┃  Álbum: ${album.name}\n`
    if (genres) txt += `┃  Género: ${genres.map(v => v.name).join(', ')}\n`
    txt += `┃  Lanzamiento: ${release_date || 'Desconocido'}\n`

    const video = videos?.[0]

    if (video) {
      const { url, title: ytTitle, author, views, timestamp, thumbnail } = video

      txt += `┃  YouTube: ${ytTitle}\n`
      txt += `┃  Canal: ${author?.name || 'Desconocido'}\n`
      txt += `┃  Vistas: ${views.toLocaleString()}\n`
      txt += `┃  Duración: ${timestamp}\n`
      txt += `┃  URL: ${url}\n`
      txt += `┗╾❑`

      const thumbRes = await fetch(thumbnail)
      const thumbBuffer = Buffer.from(await thumbRes.arrayBuffer())

      const msg = { image: thumbBuffer, caption: txt }

      whatMusicCache.set(hash, { msg, q: m })
      if (whatMusicCache.size > 200) whatMusicCache.clear()

      return conn.sendMessage(m.chat, msg, { quoted: m })
    }

    txt += `┗╾❑`

    const msg = { text: txt }

    whatMusicCache.set(hash, { msg, q: m })
    if (whatMusicCache.size > 200) whatMusicCache.clear()

    return conn.sendMessage(m.chat, msg, { quoted: m })

  } catch (err) {
    return conn.reply(m.chat, `Error: ${err.message}`, m)
  }
}

handler.help = ['𝖶𝗁𝖺𝗍𝗆𝗎𝗌𝗂𝖼 <𝖺𝗎𝖽𝗂𝗈/𝗏𝗂𝖽𝖾𝗈>']
handler.tags = ['𝖳𝖮𝖮𝖫𝖲']
handler.command = ['shazam', 'whatmusic']

export default handler