import fetch from 'node-fetch';
import axios from 'axios';

const apis = {
  deliriusFallback: 'https://delirius-apiofc.vercel.app/',
  siputzx: 'https://api.siputzx.my.id/api/',
  ryzen: 'https://apidl.asepharyana.cloud/',
  rioo: 'https://restapi.apibotwa.biz.id/',
  random1: 'https://api.agungny.my.id/api/'
};

// Timeout global
const timeoutPromise = (ms) =>
  new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

const handler = async (m, { args, conn, command, prefix }) => {
  if (!args[0]) {
    const ejemplos = ['Adele Hello', 'Sia Unstoppable', 'Maroon 5 Memories', 'Karol G Provenza', 'Natalia Jiménez Creo en mí'];
    const random = ejemplos[Math.floor(Math.random() * ejemplos.length)];
    return conn.reply(m.chat, `⚠️ Ejemplo de uso: ${(prefix || '.') + command} ${random}`, m);
  }

  await conn.sendMessage(m.chat, { react: { text: '⏱', key: m.key } });

  const query = encodeURIComponent(args.join(' '));

  // Funciones para cada API
  const fetchDelirius = async () => {
    const res = await fetch(`https://api.delirius.store/search/spotify?q=${query}`);
    const json = await res.json();
    if (!json.status || !json.data || json.data.length === 0) throw new Error('No hay resultados');
    const track = json.data[0];
    const dlRes = await fetch(`https://api.delirius.store/download/spotifydl?url=${encodeURIComponent(track.url)}`).then(r => r.json());
    if (!dlRes?.data?.url) throw new Error('No audio');
    return { track, audioUrl: dlRes.data.url };
  };

  const fetchDeliriusFallback = async () => {
    const { data } = await axios.get(`${apis.deliriusFallback}search/spotify?q=${query}&limit=10`);
    if (!data.data || data.data.length === 0) throw new Error('No hay resultados en fallback');
    const track = data.data[0];
    try {
      const res1 = await fetch(`${apis.deliriusFallback}download/spotifydl?url=${encodeURIComponent(track.url)}`);
      const dl1 = await res1.json();
      if (dl1?.data?.url) return { track, audioUrl: dl1.data.url };
      throw new Error('No audio');
    } catch {
      const res2 = await fetch(`${apis.deliriusFallback}download/spotifydlv3?url=${encodeURIComponent(track.url)}`);
      const dl2 = await res2.json();
      if (dl2?.data?.url) return { track, audioUrl: dl2.data.url };
      throw new Error('No audio fallback');
    }
  };

  // Función genérica para APIs alternativas
  const fetchOtherAPI = async (baseUrl) => {
    const { data } = await axios.get(`${baseUrl}spotify/search?q=${query}`);
    if (!data || !data.result || data.result.length === 0) throw new Error('No hay resultados');
    const track = data.result[0];
    if (!track.audio) throw new Error('No audio');
    return { track, audioUrl: track.audio };
  };

  try {
    const competitors = [
      fetchDelirius(),
      fetchDeliriusFallback(),
      fetchOtherAPI(apis.siputzx),
      fetchOtherAPI(apis.ryzen),
      fetchOtherAPI(apis.rioo),
      fetchOtherAPI(apis.random1)
    ];

    // Competencia con timeout global de 9 segundos
    const { track, audioUrl } = await Promise.race([
      Promise.any(competitors),
      timeoutPromise(9000)
    ]);

    // Enviar info
    const caption = `
╔═══『 SPOTIFY 🎶 』
║ ✦  Título: ${track.title}
║ ✦  Artista: ${track.artist}
║ ✦  Álbum: ${track.album || 'Desconocido'}
║ ✦  Duración: ${track.duration || 'Desconocida'}
║ ✦  Popularidad: ${track.popularity || 'N/A'}
║ ✦  Publicado: ${track.publish || 'N/A'}
║ ✦  Link: ${track.url || 'N/A'}
╚═════════════════╝`;

    await conn.sendMessage(m.chat, { image: { url: track.image || '' }, caption }, { quoted: m });
    await conn.sendMessage(m.chat, { audio: { url: audioUrl }, mimetype: 'audio/mpeg', fileName: `${track.title}.mp3` }, { quoted: m });
    await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });

  } catch (e) {
    console.log(e);
    if (e.message === 'timeout') {
      return m.reply('❌ Ninguna API respondió en 9 segundos. Intenta nuevamente.', m);
    }
    m.reply('❌ No se pudo obtener la canción.', m);
  }
};

handler.help = ['spotify <canción>'];
handler.tags = ['busqueda', 'descargas'];
handler.command = ['spotify'];

export default handler;