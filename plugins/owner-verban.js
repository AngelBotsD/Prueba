let handler = async (m, { conn }) => {
  console.log("FUNC:", conn.queryBlocklistStatus);
  m.reply("Listo bro, revisa la consola.");
};

handler.command = /^tete$/i;
export default handler;