import fetch from 'node-fetch';

// ----------------------------------------------------------------
// Gemini interno (tu código original aquí integrado)
// ----------------------------------------------------------------

const gemini = {
  getNewCookie: async function () {
    const res = await fetch(
      "https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=maGuAc&source-path=%2F&bl=boq_assistant-bard-web-server_20250814.06_p1&f.sid=-7816331052118000090&hl=en-US&_reqid=173780&rt=c",
      {
        headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: "f.req=%5B%5B%5B%22maGuAc%22%2C%22%5B0%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&",
        method: "POST",
      }
    );

    const cookieHeader = res.headers.get("set-cookie");
    if (!cookieHeader) throw new Error("⚠️ Gemini no devolvió cookie.");
    return cookieHeader.split(";")[0];
  },

  ask: async function (prompt, previousId = null) {
    if (!prompt.trim()) throw new Error("❌ Escribe algo válido.");

    let resumeArray = null;
    let cookie = null;

    if (previousId) {
      try {
        const json = JSON.parse(Buffer.from(previousId, "base64").toString());
        resumeArray = json.newResumeArray;
        cookie = json.cookie;
      } catch {
        previousId = null;
      }
    }

    const headers = {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      "x-goog-ext-525001261-jspb": "[1,null,null,null,\"9ec249fc9ad08861\",null,null,null,[4]]",
      cookie: cookie || await this.getNewCookie(),
    };

    const b = [[prompt], ["es-MX"], resumeArray];
    const a = [null, JSON.stringify(b)];
    const body = new URLSearchParams({ "f.req": JSON.stringify(a) });

    const response = await fetch(
      "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=boq_assistant-bard-web-server_20250729.06_p0&f.sid=4206607810970164620&hl=en-US&_reqid=2813378&rt=c",
      { method: "POST", headers, body }
    );

    const textData = await response.text();
    const match = textData.matchAll(/^\d+\n(.+?)\n/gm);
    const chunks = Array.from(match, m => m[1]);

    let text = null;
    let newResumeArray = null;

    for (const chunk of chunks.reverse()) {
      try {
        const realArray = JSON.parse(chunk);
        const parsed = JSON.parse(realArray[0][2]);

        if (parsed?.[4]?.[0]?.[1]?.[0]) {
          text = parsed[4][0][1][0].replace(/\*\*(.+?)\*\*/g, "*$1*");
          newResumeArray = [...parsed[1], parsed[4][0][0]];
          break;
        }
      } catch {}
    }

    if (!text) throw new Error("❌ Gemini cambió la respuesta.");

    const id = Buffer.from(JSON.stringify({ newResumeArray, cookie: headers.cookie })).toString("base64");

    return { text, id };
  }
};

// Memoria por usuario
const sessions = {};

// ----------------------------------------------------------------
//                TU HANDLER USANDO GEMINI REAL
// ----------------------------------------------------------------

let handler = async (m, { text, conn }) => {

  const isTagged = m.mentionedJid?.includes(conn.user.jid) || false;
  const isCommand = /^[\.]?(bot|gemini)/i.test(m.text);

  if (!isTagged && !isCommand) return;

  let query = m.text
    .replace(new RegExp(`@${conn.user.jid.split('@')[0]}`, 'i'), '')
    .replace(/^[\.]?(bot|gemini)\s*/i, '')
    .trim();

  if (!query) {
    return m.reply(`¡Hola!\nSoy *Angel Bot* 🤖\n¿En qué te ayudo hoy? ❤️`);
  }

  try {
    await conn.sendPresenceUpdate('composing', m.chat);

    const prev = sessions[m.sender];
    const result = await gemini.ask(query, prev);
    sessions[m.sender] = result.id;

    await m.reply(result.text || "⚠️ Gemini no respondió.");
  } catch (e) {
    console.error(e);
    await m.reply("❌ Ocurrió un error con Gemini.");
  }
};

handler.customPrefix = /^(\.?bot|\.?gemini|@\d+)/i;
handler.command = new RegExp;
handler.tags = ["ai"];

export default handler;