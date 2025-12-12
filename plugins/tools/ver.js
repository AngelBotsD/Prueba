const handler = async (msg, ctx = {}) => {
  const { conn } = ctx;

  // 🔧 Compat: asegura wa aunque el dispatcher no lo pase
  const wa =
    (ctx.wa && typeof ctx.wa.downloadContentFromMessage === "function")
      ? ctx.wa
      : (conn && conn.wa && typeof conn.wa.downloadContentFromMessage === "function")
        ? conn.wa
        : (global.wa && typeof global.wa.downloadContentFromMessage === "function")
          ? global.wa
          : null;

  try {
    if (!wa) {
      // Sin wa disponible: avisamos y salimos limpio
      return await conn.sendMessage(
        msg.key.remoteJid,
        { text: "⚠️ Falta el helper de medios. Reinicia el bot (index.js ya inyecta `global.wa`)." },
        { quoted: msg }
      );
    }

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) {
      return conn.sendMessage(
        msg.key.remoteJid,
        { text: "❌ *Error:* Debes responder a una imagen, video o nota de voz para reenviarla." },
        { quoted: msg }
      );
    }

    // Desencapsula viewOnce/ephemeral
    const unwrap = (m) => {
      let node = m;
      while (
        node?.viewOnceMessage?.message ||
        node?.viewOnceMessageV2?.message ||
        node?.viewOnceMessageV2Extension?.message ||
        node?.ephemeralMessage?.message
      ) {
        node =
          node.viewOnceMessage?.message ||
          node.viewOnceMessageV2?.message ||
          node.viewOnceMessageV2Extension?.message ||
          node.ephemeralMessage?.message;
      }
      return node;
    };

    const inner = unwrap(quoted);

    let mediaType, mediaMsg;
    if (inner?.imageMessage) {
      mediaType = "image"; mediaMsg = inner.imageMessage;
    } else if (inner?.videoMessage) {
      mediaType = "video"; mediaMsg = inner.videoMessage;
    } else if (inner?.audioMessage || inner?.voiceMessage || inner?.pttMessage) {
      mediaType = "audio";
      mediaMsg = inner.audioMessage || inner.voiceMessage || inner.pttMessage;
    } else {
      return conn.sendMessage(
        msg.key.remoteJid,
        { text: "❌ *Error:* El mensaje citado no contiene un archivo compatible." },
        { quoted: msg }
      );
    }

    await conn.sendMessage(msg.key.remoteJid, { react: { text: "⏳", key: msg.key } });

    // ✅ usar wa.downloadContentFromMessage garantizado
    const stream = await wa.downloadContentFromMessage(mediaMsg, mediaType);
    let buf = Buffer.alloc(0);
    for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);

    const credit = "";
    const opts = { mimetype: mediaMsg.mimetype };

    if (mediaType === "image") {
      opts.image = buf;
      opts.caption = credit;
    } else if (mediaType === "video") {
      opts.video = buf;
      opts.caption = credit;
    } else {
      opts.audio = buf;
      // Mostrar como nota de voz si el original lo era (o por defecto true)
      opts.ptt = mediaMsg.ptt ?? true;
      if (mediaMsg.seconds) opts.seconds = mediaMsg.seconds;
    }

    await conn.sendMessage(msg.key.remoteJid, opts, { quoted: msg });

    if (mediaType === "audio") {
      await conn.sendMessage(msg.key.remoteJid, { text: credit }, { quoted: msg });
    }

    await conn.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } });
  } catch (err) {
    console.error("❌ Error en comando ver:", err);
    await conn.sendMessage(
      msg.key.remoteJid,
      { text: "❌ *Error:* Hubo un problema al procesar el archivo." },
      { quoted: msg }
    );
  }
};


handler.help = ["𝖱𝖾𝖾𝗇𝗏𝗂𝖺𝗋"]
handler.tags = ["𝖳𝖮𝖮𝖫𝖲"]
handler.command = ["ver", "reenviar"];
export default handler;