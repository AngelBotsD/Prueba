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

    // 🔥 Formato perfecto para activar "COPIAR LINK"
    const link = `https://chat.whatsapp.com/${inviteCode}

*${groupName}*`;

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
      { text: "⚠️ Ocurrió un error obteniendo el link del grupo." },
      { quoted: m }
    );
  }
};

handler.help = ["𝖫𝗂𝗇𝗄"];
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"];
handler.customPrefix = /^\.?(link)$/i;
handler.command = new RegExp();
handler.group = true;
handler.admin = true;
export default handler;