import fetch from 'node-fetch';
import axios from 'axios';

const apis = {
  delirius: 'https://delirius-apiofc.vercel.app/'
};

const handler = async (m, { conn, command, args, text, usedPrefix }) => {

  if (!text) return m.reply(`*💽 𝙸𝚗𝚐𝚛𝚎𝚜𝚊 𝚎𝚕 𝙽𝚘𝚖𝚋𝚛𝚎 𝚍𝚎 𝙰𝚕𝚐𝚞𝚗𝚊 𝙲𝚊𝚗𝚌𝚒𝚘𝚗 𝙴𝚗 𝚂𝚙𝚘𝚝𝚒𝚏𝚢*`);

  try {
    await conn.sendMessage(m.chat, { react: { text: '🕒', key: m.key }});

    let { data } = await axios.get(`${apis.delirius}search/spotify?q=${encodeURIComponent(text)}&limit=10`);

    if (!data.data || data.data.length === 0) {
      throw `_*[ ⚠️ ] No se encontraron resultados para "${text}" en Spotify.*_`;
    }

    const song = data.data[0];
    const img = song.image;
    const url = song.url;

    const info = `> *𝚂𝙿𝙾𝚃𝙸𝙵𝚈 𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳𝙴𝚁*\n\n🎵 *𝚃𝚒𝚝𝚞𝚕𝚘:* ${song.title}\n🎤 *𝙰𝚛𝚝𝚒𝚜𝚝𝚊:* ${song.artist}\n🕒 *𝙳𝚞𝚛𝚊𝚌𝚒ó𝚗:* ${song.duration}`;

    await conn.sendFile(m.chat, img, 'imagen.jpg', info, m);

    try {
      const api1 = `${apis.delirius}download/spotifydl?url=${encodeURIComponent(url)}`;
      const response1 = await fetch(api1);
      const result1 = await response1.json();

      const downloadUrl1 = result1.data.url;
      await conn.sendMessage(m.chat, { audio: { url: downloadUrl1 }, fileName: 'audio.mp3', mimetype: 'audio/mpeg', quoted: m });

      await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key }});

    } catch (e1) {
      try {
        const api2 = `${apis.delirius}download/spotifydlv3?url=${encodeURIComponent(url)}`;
        const response2 = await fetch(api2);
        const result2 = await response2.json();

        const downloadUrl2 = result2.data.url;
        await conn.sendMessage(m.chat, { audio: { url: downloadUrl2 }, fileName: 'audio.mp3', mimetype: 'audio/mpeg', quoted: m });

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key }});

      } catch (e2) {
        m.reply(`❌ Ocurrió un error al descargar el audio\nError:${e2.message}`);
      }
    }

  } catch (e) {
    await conn.reply(m.chat, `> Intenta Nuevamente.`, m);
    console.log(e);
  }
};

handler.tags = ['downloader']; 
handler.help = ['spotify'];
handler.command = ['spotify'];
export default handler;