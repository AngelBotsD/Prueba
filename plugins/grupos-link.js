import fetch from "node-fetch";

const handler = async (m, { conn }) => {
  try {
    const [inviteCode, ppUrl] = await Promise.all([
      conn.groupInviteCode(m.chat),
      conn.profilePictureUrl(m.chat, "image").catch(() => null),
    ]);

    const link = `🗡️ https://chat.whatsapp.com/${inviteCode}`;

    const msg = ppUrl
      ? { image: { url: ppUrl }, caption: link }
      : { text: link };

    await Promise.all([
      conn.sendMessage(m.chat, msg, { quoted: m }),
      conn.sendMessage(m.chat, { react: { text: "✅", key: m.key } }),
    ]);

  } catch (error) {
    console.error(error);
    await conn.sendMessage(m.chat, { text: "❌ Ocurrió un error al obtener el link." }, { quoted: m });
  }
};

handler.customPrefix = /^\.?(link)$/i;
handler.command = new RegExp();
handler.group = true;
handler.admin = true;

export default handler;