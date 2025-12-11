// plugins/react.js — ESM optimizado
import fetch from "node-fetch";

const handler = async (msg, { conn, text, args }) => {
  const chat = msg.key.remoteJid;
  const raw = (text || args.join(" ")).trim();

  if (!raw) {
    return conn.sendMessage(
      chat,
      {
        text:
          "👻 Uso: .react <link_post> <emoji1,emoji2,emoji3,emoji4>\n\n" +
          "Ejemplo:\n.rc https://whatsapp.com/channel/xxx/123 😨,🤣,👾,😳",
      },
      { quoted: msg }
    );
  }

  await conn.sendMessage(chat, { react: { text: "⏳", key: msg.key } });

  try {
    const [postLink, ...rest] = raw.split(" ");
    const emojiArray = rest.join(" ")
      .split(/[,，]/)
      .map((x) => x.trim())
      .filter(Boolean);

    // Validaciones rápidas
    if (!/whatsapp\.com\/channel\//i.test(postLink))
      return fail("🚫 Link inválido, debe ser un post de canal.");

    if (!emojiArray.length)
      return fail("⚠️ Escribe mínimo 1 emoji.");

    if (emojiArray.length > 4)
      return fail("❗ Máximo 4 emojis permitidos.");

    const apiKey =
      process.env.REACT_API_KEY ||
      "42699f4385a23f089abfd6948dd6ff366db8aef340eab58f69839b885b8b5e75";

    const body = {
      post_link: postLink,
      reacts: emojiArray.join(","),
    };

    const response = await fetch(
      "https://foreign-marna-sithaunarathnapromax-9a005c2e.koyeb.app/api/channel/react-to-post",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      }
    );

    const json = await response.json().catch(() => ({}));

    if (!response.ok || (!json?.success && !json?.message))
      return fail("❌ No se pudieron enviar las reacciones.");

    // OK ✔
    await conn.sendMessage(chat, { react: { text: "✅", key: msg.key } });
    return conn.sendMessage(
      chat,
      { text: "✅ Reacciones enviadas con éxito 👻" },
      { quoted: msg }
    );

    // Función compacta de error
    function fail(msgText) {
      conn.sendMessage(chat, { react: { text: "❌", key: msg.key } });
      return conn.sendMessage(chat, { text: msgText }, { quoted: msg });
    }
  } catch (e) {
    console.error("[react-opt] Error:", e);
    conn.sendMessage(chat, { react: { text: "❌", key: msg.key } });
    return conn.sendMessage(
      chat,
      { text: "⚠️ Ocurrió un error inesperado." },
      { quoted: msg }
    );
  }
};

handler.command = ["r", "rc", "channelreact"];
export default handler;