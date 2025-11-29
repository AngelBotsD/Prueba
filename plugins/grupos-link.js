import fetch from "node-fetch";

const handler = async (m, { conn }) => {
  const chat = m.chat;

  if (!chat.endsWith("@g.us")) {
    return conn.sendMessage(chat, {
      text: "❌ Este comando solo funciona en *grupos*."
    }, { quoted: m });
  }

  try {
    // Obtener metadata + link al mismo tiempo (PARALELO)
    const [meta, code] = await Promise.all([
      conn.groupMetadata(chat),
      conn.groupInviteCode(chat)
    ]);

    if (!code) {
      return conn.sendMessage(chat, {
        text: "🚫 Necesito ser *administrador* para obtener el link del grupo."
      }, { quoted: m });
    }

    const groupName = meta.subject || "Grupo";
    const link = `https://chat.whatsapp.com/${code}`;

    // ==============================
    // FOTO DEL GRUPO - ultra rápida
    // ==============================

    const fallback = "https://files.catbox.moe/xr2m6u.jpg";

    const getPhoto = async () => {
      try {
        const url = await conn.profilePictureUrl(chat, "image").catch(() => null);
        if (!url) return null;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) return null;
        return Buffer.from(await res.arrayBuffer());
      } catch {
        return null;
      }
    };

    // FOTO: si falla → fallback instantáneo (Promise.race)
    const ppBuffer = await Promise.race([
      getPhoto(),
      new Promise(resolve => setTimeout(() => resolve(null), 6000))
    ]) || await fetch(fallback).then(r => r.buffer());

    // ==============================
    // CAPTION
    // ==============================
    const caption =`${groupName}\n\n 
${link}
`;

    // ==============================
    // ENVÍO OPTIMIZADO
    // ==============================

    await conn.sendMessage(chat, {
      image: ppBuffer,
      caption
    }, { quoted: m });

    conn.sendMessage(chat, {
      react: { text: "🔗", key: m.key }
    });

  } catch (err) {
    console.error("❌ Error en .link:", err);
    conn.sendMessage(chat, {
      text: "⚠️ Error inesperado al obtener el link."
    }, { quoted: m });
  }
};

handler.help = ["link", "enlace"];
handler.tags = ["grupo"];
handler.command = /^(link|enlace)$/i;
handler.group = true;

export default handler;