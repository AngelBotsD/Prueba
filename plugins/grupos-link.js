import fetch from "node-fetch";

const handler = async (m, { conn }) => {
  try {
    const inviteCode = await conn.groupInviteCode(m.chat).catch(() => null);

    if (!inviteCode) {
      return conn.sendMessage(
        m.chat,
        { text: "🚫 Para obtener el link y la foto, necesito ser *administrador*." },
        { quoted: m }
      );
    }

    const metadata = await conn.groupMetadata(m.chat);
    const groupName = metadata?.subject || "Grupo";

    const link = `*${groupName}*\nhttps://chat.whatsapp.com/${inviteCode}`;

    let ppBuffer = null;
    try {
      const url = await conn.profilePictureUrl(m.chat, "image");
      const res = await fetch(url);
      ppBuffer = await res.buffer();
    } catch {}

    const msg = ppBuffer
      ? { image: ppBuffer, caption: link }
      : { text: link };

    await Promise.all([
      conn.sendMessage(m.chat, msg, { quoted: m }),
      conn.sendMessage(m.chat, { react: { text: "✅", key: m.key } })
    ]);

  } catch (error) {
    console.error(error);
    await conn.sendMessage(
      m.chat,
      { text: "❌ Error inesperado al obtener el link o la foto del grupo." },
      { quoted: m }
    );
  }
};

handler.customPrefix = /^\.?(link)$/i;
handler.command = new RegExp();
handler.group = true;
handler.admin = true;

export default handler;