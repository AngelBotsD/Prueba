let handler = async (m, { conn, usedPrefix }) => {

  let messageText = "Hola 👋";
  let dev = "Opciones de prueba";
  let thumbnail = null;

  // Puedes cargar cualquier imagen que quieras aquí
  // thumbnail = (await conn.getFile('URL_O_BUFFER_DE_IMAGEN')).data;

  let video = { url: "https://youtube.com" }; // URL fake solo para probar

  await conn.sendMessage(
    m.chat,
    {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            header: {
              title: messageText,
              hasMediaAttachment: false, // si pones thumbnail, cámbialo a true
            },

            body: { text: dev },
            footer: { text: "" },

            nativeFlowMessage: {
              buttons: [
                {
                  name: "quick_reply",
                  buttonParamsJson: JSON.stringify({
                    display_text: "Audio",
                    id: `${usedPrefix}ytmp3_v2 ${video.url}`
                  })
                },
                {
                  name: "quick_reply",
                  buttonParamsJson: JSON.stringify({
                    display_text: "Vídeo",
                    id: `${usedPrefix}ytmp4 ${video.url}`
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
};

handler.command = ["hola"];
export default handler;