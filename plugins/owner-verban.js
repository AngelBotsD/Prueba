import yts from 'yt-search';
import fetch from 'node-fetch';
import { prepareWAMessageMedia, generateWAMessageFromContent } from '@whiskeysockets/baileys';

const handler = async (m, { conn, args, usedPrefix }) => {
    if (!args[0]) return conn.reply(m.chat, '*`Por favor ingresa un término de búsqueda`*', m);

    await m.react('🕓');

    try {
        let query = args.join(" ");
        let searchResults = await searchVideos(query);
        let spotifyResults = await searchSpotify(query);

        if (!searchResults.length && !spotifyResults.length)
            throw new Error('No se encontraron resultados.');

        let video = searchResults[0];
        let thumbnail = await (await fetch(video.miniatura)).buffer();

        let messageText =
`> *YouTube Play 🧇*\n
${video.titulo}

• *Duración:* ${video.duracion}
• *Autor:* ${video.canal}
• *Publicado:* ${convertTimeToSpanish(video.publicado)}
• *Enlace:* ${video.url}
        `;

        // Secciones YouTube
        let ytSections = searchResults.slice(1, 11).map((v, i) => ({
            title: `${i + 1}┃ ${v.titulo}`,
            rows: [
                {
                    title: `🎶 Descargar MP3`,
                    description: `Duración: ${v.duracion}`,
                    id: `${usedPrefix}ytmp3 ${v.url}`
                },
                {
                    title: `🎥 Descargar MP4`,
                    description: `Duración: ${v.duracion}`,
                    id: `${usedPrefix}ytmp4 ${v.url}`
                }
            ]
        }));

        // Secciones Spotify
        let spotifySections = spotifyResults.slice(0, 10).map((s, i) => ({
            title: `${i + 1}┃ ${s.titulo}`,
            rows: [
                {
                    title: `🎶 Descargar Audio`,
                    description: `Duración: ${s.duracion}`,
                    id: `${usedPrefix}spotify ${s.url}`
                }
            ]
        }));

        // Imagen como header DS6
        const headerImage = await prepareWAMessageMedia(
            { image: thumbnail },
            { upload: conn.waUploadToServer }
        );

        const msg = generateWAMessageFromContent(
            m.chat,
            {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: {
                            header: {
                                title: messageText,
                                subtitle: "",
                                hasMediaAttachment: true,
                                imageMessage: headerImage.imageMessage
                            },
                            body: { text: "" },
                            footer: { text: "ᴘʀᴇꜱɪᴏɴᴀ ᴜɴ ʙᴏᴛᴏɴ ᴘᴀʀᴀ ᴅᴇꜱᴄᴀʀɢᴀ" },
                            nativeFlowMessage: {
                                buttons: [
                                    {
                                        name: "quick_reply",
                                        buttonParamsJson: JSON.stringify({
                                            display_text: "ᯓᡣ𐭩 Audio",
                                            id: `${usedPrefix}ytmp3 ${video.url}`
                                        })
                                    },
                                    {
                                        name: "quick_reply",
                                        buttonParamsJson: JSON.stringify({
                                            display_text: "ᯓᡣ𐭩 Video",
                                            id: `${usedPrefix}ytmp4 ${video.url}`
                                        })
                                    },
                                    {
                                        name: "single_select",
                                        buttonParamsJson: JSON.stringify({
                                            title: "Resultados YouTube",
                                            sections: ytSections
                                        })
                                    },
                                    {
                                        name: "single_select",
                                        buttonParamsJson: JSON.stringify({
                                            title: "Resultados Spotify",
                                            sections: spotifySections
                                        })
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            { quoted: m }
        );

        await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
        await m.react('✅');

    } catch (e) {
        console.error(e);
        await m.react('✖️');
        conn.reply(m.chat, '*`Error al buscar el video.`*', m);
    }
};


handler.help = ['play *<texto>*'];
handler.tags = ['dl'];
handler.command = ['xd'];
export default handler;


// FUNCIONES
async function searchVideos(query) {
    try {
        const res = await yts(query);
        return res.videos.slice(0, 11).map(video => ({
            titulo: video.title,
            url: video.url,
            miniatura: video.thumbnail,
            canal: video.author.name,
            publicado: video.timestamp || 'No disponible',
            vistas: video.views || 'No disponible',
            duracion: video.duration.timestamp || 'No disponible'
        }));
    } catch {
        return [];
    }
}

async function searchSpotify(query) {
    try {
        const data = await (await fetch(
            `https://delirius-apiofc.vercel.app/search/spotify?q=${encodeURIComponent(query)}`
        )).json();

        return data.data.slice(0, 10).map(track => ({
            titulo: track.title,
            url: track.url,
            duracion: track.duration || 'No disponible'
        }));

    } catch {
        return [];
    }
}

function convertTimeToSpanish(timeText) {
    return timeText
        .replace(/year/, 'año').replace(/years/, 'años')
        .replace(/month/, 'mes').replace(/months/, 'meses')
        .replace(/day/, 'día').replace(/days/, 'días')
        .replace(/hour/, 'hora').replace(/hours/, 'horas')
        .replace(/minute/, 'minuto').replace(/minutes/, 'minutos');
}