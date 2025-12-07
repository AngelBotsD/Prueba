const handler = async (m, { conn }) => {
  const chat = m.chat;

  conn.sendMessage(chat, {
    react: { text: "🔗", key: m.key }
  });

  try {

    const safeFetch = async (url, timeout = 5000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await fetch(url, { signal: controller.signal });
        return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
      } catch {
        return null;
      } finally {
        clearTimeout(id);
      }
    };

    const [meta, code] = await Promise.all([
      conn.groupMetadata(chat),
      conn.groupInviteCode(chat).catch(() => null)
    ]);

    const groupName = meta.subject || "Grupo";
    const link = code
      ? `https://chat.whatsapp.com/${code}`
      : "Sin enlace disponible";

    const fallback = "https://files.catbox.moe/xr2m6u.jpg";
    let ppBuffer = null;

    try {
      const url = await conn.profilePictureUrl(chat, "image").catch(() => null);

      if (url && url !== "not-authorized" && url !== "not-exist") {
        ppBuffer = await safeFetch(url, 6000);
      }
    } catch (e) {
      console.warn("Error obteniendo foto del grupo:", e);
    }

    if (!ppBuffer) {
      ppBuffer = await safeFetch(fallback);
    }

    await conn.sendMessage(
      chat,
      {
        image: ppBuffer,
        caption: `*${groupName}*\n${link}`
      },
      { quoted: m }
    );

  } catch (err) {
    console.error("⚠️ Error en comando .link:", err);

    conn.sendMessage(chat, {
      text: "❌ Ocurrió un error al generar el enlace."
    }, { quoted: m });
  }
};

handler.help = ["𝖫𝗂𝗇𝗄"];
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"];
handler.customPrefix = /^\.?(link)$/i;
handler.command = new RegExp();
handler.group = true;
handler.admin = true;
export default handler;