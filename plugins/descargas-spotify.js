import fetch from 'node-fetch';
import axios from 'axios';

const apis = {
  search: 'https://delirius-apiofc.vercel.app/search/spotify',
  download: 'https://api.delirius.store/download/spotifydl'
};

const handler = async (m, { conn, args, text }) => {
  if (!text) return m.reply(`*💽 Ingresa el nombre de alguna canción en Spotify*`);

  try {
    // Reacción de "procesando"
    await conn.sendMessage(m.chat, { react: { text: '🕒', key: m.key }});

    // Buscar canción
    const { data } = await axios.get(`${apis.search}?q=${encodeURIComponent(text)}&limit=10`);
    if (!data.data || data.data.length === 0) {
      throw `_*[ ⚠️ ] No se encontraron resultados para "${text}" en Spotify.*_`;
    }

    const song = data.data[0];
    const img = song.image;
    const info = `> *SPOTIFY DOWNLOADER*\n\n🎵 *Título:* ${song.title}\n🎤 *Artista:* ${song.artist}\n🕒 *Duración:* ${song.duration}`;

    // Enviar info e imagen
    await conn.sendFile(m.chat, img, 'imagen.jpg', info, m);

    // Descargar usando la nueva API
    const downloadUrl = `${apis.download}?url=${encodeURIComponent(song.url)}`;
    await conn.sendMessage(m.chat, { audio: { url: downloadUrl }, fileName: 'audio.mp3', mimetype: 'audio/mpeg', quoted: m });

    // Reacción de "listo"
    await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key }});

  } catch (e) {
    await conn.reply(m.chat, `❌ Ocurrió un error, intenta nuevamente.`, m);
    console.log(e);
  }
};

handler.tags = ['downloader']; 
handler.help = ['spotify'];
handler.command = ['spotify'];
export default handler;