const arabes = [
  "20","212","213","216","218","222","224","230","234","235","237","238","249",
  "250","251","252","253","254","255","257","258","260","263","269","960","961",
  "962","963","964","965","966","967","968","970","971","972","973","974","975",
  "976","980","981","992","994","995","998"
];

export async function participantsUpdate({ id, participants, action }, { conn }) {
  if (action !== "add") return;

  const chat = global.db.data.chats[id] || {};

  if (!chat.antiArabes) return;

  for (let user of participants) {
    const number = user.split("@")[0];

    // Ahora sí detecta el prefijo REAL
    const prefix = number.slice(0, 3);

    if (arabes.includes(prefix)) {
      try {
        await conn.sendMessage(id, {
          text: `⚠️ El número *+${number}* no está permitido en este grupo.`,
          mentions: [user]
        });

        await conn.groupParticipantsUpdate(id, [user], "remove");
      } catch (err) {
        console.error("Error al expulsar número bloqueado:", err);
      }
    }
  }
}