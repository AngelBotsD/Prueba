import fs from "fs";
import path from "path";

const DIGITS = (s = "") => String(s || "").replace(/\D/g, "");

function findParticipantByDigits(parts = [], digits = "") {
  if (!digits) return null;
  return (
    parts.find(
      (p) =>
        DIGITS(p?.id || "") === digits ||
        DIGITS(p?.jid || "") === digits
    ) || null
  );
}

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const isGroup = chatId.endsWith("@g.us");
  const isFromMe = !!msg.key.fromMe;

  const senderRaw = msg.key.participant || msg.key.remoteJid;
  const senderNum = DIGITS(
    typeof msg.realJid === "string" ? msg.realJid : senderRaw
  );

  if (!isGroup) {
    await conn.sendMessage(
      chatId,
      { text: "❌ Este comando solo funciona en grupos." },
      { quoted: msg }
    );
    return;
  }

  const ownerPath = path.resolve("owner.json");
  const owners = fs.existsSync(ownerPath)
    ? JSON.parse(fs.readFileSync(ownerPath, "utf-8"))
    : [];
  const isOwner = owners.some(([id]) => id === senderNum);

  const botRaw = conn.user?.id || "";
  const botNum = DIGITS(botRaw.split(":")[0]);
  const isBot = botNum === senderNum;

  let metadata;
  try {
    metadata = await conn.groupMetadata(chatId);
  } catch (e) {
    await conn.sendMessage(
      chatId,
      { text: "❌ No pude leer la metadata del grupo." },
      { quoted: msg }
    );
    return;
  }

  const participantes = metadata?.participants || [];

  const authorP = findParticipantByDigits(participantes, senderNum);
  const isAdmin = authorP && (authorP.admin === "admin" || authorP.admin === "superadmin");

  if (!isAdmin && !isOwner && !isBot && !isFromMe) {
    await conn.sendMessage(
      chatId,
      { text: "⛔ Solo administradores u owners pueden usar este comando." },
      { quoted: msg }
    );
    return;
  }

  const ctx = msg.message?.extendedTextMessage?.contextInfo || {};
  const mentioned = ctx.mentionedJid || [];
  const quotedJid = ctx.participant || null;

  const targetDigits = new Set(
    [
      ...mentioned.map((j) => DIGITS(j)),
      quotedJid ? DIGITS(quotedJid) : ""
    ].filter(Boolean)
  );

  if (targetDigits.size === 0) {
    await conn.sendMessage(
      chatId,
      {
        text:
          "📌 Debes mencionar o responder al usuario que deseas expulsar.\nEjemplo:\n.kick @usuario"
      },
      { quoted: msg }
    );
    return;
  }

  const expulsar = [];
  const resultados = [];
  const mentionsOut = [];

  for (const d of targetDigits) {
    if (d === senderNum) {
      resultados.push(`⚠️ No puedes expulsarte a ti mismo (@${d}).`);
      continue;
    }

    if (d === botNum) {
      resultados.push(`⚠️ No puedo expulsarme a mí (@${d}).`);
      continue;
    }

    const targetP = findParticipantByDigits(participantes, d);
    if (!targetP) {
      resultados.push(`❌ No encontré al usuario @${d} en este grupo.`);
      continue;
    }

    const targetGroupId = targetP.id || targetP.jid;

    const isTargetOwner = owners.some(([id]) => id === d);
    if (isTargetOwner) {
      resultados.push(`⚠️ No puedo expulsar a @${d} (owner).`);
      continue;
    }

    expulsar.push(targetGroupId);
    mentionsOut.push(targetGroupId);
  }

  if (expulsar.length > 0) {
    try {
      await conn.groupParticipantsUpdate(chatId, expulsar, "remove");
      expulsar.forEach((u) => {
        resultados.push(`✅ Usuario expulsado: @${DIGITS(u)}.`);
      });
    } catch (err) {
      resultados.push("❌ Error al expulsar usuarios.");
    }
  }

  await conn.sendMessage(
    chatId,
    { text: resultados.join("\n"), mentions: mentionsOut },
    { quoted: msg }
  );

  await conn.sendMessage(chatId, { react: { text: "👢", key: msg.key } }).catch(() => {});
};

handler.command = ["kick"];
export default handler;