function cleanJid(jid) {
    if (!jid) return jid;
    return jid
        .replace(/:.*@/, '@')
        .replace(/[\s\n\r]+/g, '')
        .replace(/@.+/, '@s.whatsapp.net');
}

function ensureDB() {
    if (!global.db) global.db = { data: { users: {}, chats: {} } };
    if (!global.db.data) global.db.data = { users: {}, chats: {} };
    if (!global.db.data.users) global.db.data.users = {};
    if (!global.db.data.chats) global.db.data.chats = {};
}

export async function messageHandler(m, { conn }) {
    try {
        if (!m.isGroup) return;
        if (!m.sender) return;
        ensureDB();

        let sender = cleanJid(m.sender);
        let chat = m.chat;

        if (!global.db.data.chats[chat]) global.db.data.chats[chat] = {};
        if (sender === cleanJid(conn.user.jid)) return;
        if (!m.message) return;

        const tiposValidos = Object.keys(m.message || {});
        const tipo = tiposValidos.length ? tiposValidos[0] : null;
        if (!tipo) return;

        if (!global.db.data.users[sender]) global.db.data.users[sender] = { groups: {} };
        let user = global.db.data.users[sender];

        if (!user.groups) user.groups = {};
        if (!user.groups[chat]) user.groups[chat] = {};
        user.name = m.pushName || user.name || null;
        user.groups[chat].lastMessage = Date.now();

    } catch {}
}

let handler = async (m, { conn, participants, command }) => {
    try {
        ensureDB();

        const HORAS = 72;
        const INACTIVIDAD = HORAS * 60 * 60 * 1000;
        const ahora = Date.now();

        if (!participants || !Array.isArray(participants)) {
            let metadata = await conn.groupMetadata(m.chat).catch(() => null);
            if (!metadata) return;
            participants = metadata.participants;
        }

        let miembros = participants.map(v => v.id);
        let fantasmas = [];

        for (let raw of miembros) {
            let usuario = cleanJid(raw);
            let real = raw;

            if (usuario === cleanJid(conn.user.jid)) continue;

            let p = participants.find(u => u.id === real);
            let isAdmin = !!(p?.admin || p?.isAdmin || p?.isSuperAdmin);
            if (isAdmin) continue;

            let dataUser = global.db.data.users[usuario];
            let lastMsg = dataUser?.groups?.[m.chat]?.lastMessage || 0;

            if (!lastMsg || ahora - lastMsg >= INACTIVIDAD) fantasmas.push(real);
        }

        fantasmas = [...new Set(fantasmas)];

        if (fantasmas.length === 0) {
            return conn.reply(m.chat, "✨ No hay fantasmas en este grupo.", m);
        }

        if (command === "fankick") {
            try {
                await conn.groupParticipantsUpdate(m.chat, fantasmas, "remove");

                let msg = fantasmas.map(v => {
                    let nombre = v.replace(/@.+/, "");
                    return `🔥 @${nombre}`;
                }).join('\n');

                return conn.reply(m.chat, `🔥 Fantasmas eliminados:\n${msg}`, null, { mentions: fantasmas });

            } catch {
                return conn.reply(m.chat, "No pude expulsar a algunos participantes.", m);
            }
        }

        let lista = fantasmas.map(v => {
            let nombre = v.replace(/@.+/, "");
            return `👻 @${nombre}`;
        }).join('\n');

        let msg = `
👻 FANTASMAS DETECTADOS (72H)

Grupo: ${await conn.getName(m.chat)}

${lista}

Usa .fankick para expulsarlos.
`;

        conn.reply(m.chat, msg.trim(), null, { mentions: fantasmas });

    } catch {}
};

handler.command = /^(fantasmas|sider|verfantasmas|fankick)$/i;
handler.admin = true;

export default handler;

export function initAutoFantasma(conn) {
    if (!conn) throw new Error("initAutoFantasma necesita conn");
    if (global.autoFantasmaIniciado) return;

    global.autoFantasmaIniciado = true;

    const INTERVAL_MS = 24 * 60 * 60 * 1000;

    setInterval(async () => {
        try {
            ensureDB();

            let chats = Object.keys(global.db.data.chats);

            for (let id of chats) {
                let chat = global.db.data.chats[id];
                if (!chat?.autoFantasma) continue;

                let metadata = await conn.groupMetadata(id).catch(() => null);
                if (!metadata) continue;

                let participants = metadata.participants;

                const HORAS = 72;
                const INACTIVIDAD = HORAS * 60 * 60 * 1000;
                const ahora = Date.now();

                let fantasmas = [];

                for (let p of participants) {
                    let real = p.id;
                    let usuario = cleanJid(real);

                    if (usuario === cleanJid(conn.user.jid)) continue;
                    let isAdmin = !!(p.admin || p.isAdmin || p.isSuperAdmin);
                    if (isAdmin) continue;

                    let dataUser = global.db.data.users[usuario];
                    let lastMsg = dataUser?.groups?.[id]?.lastMessage || 0;

                    if (!lastMsg || ahora - lastMsg >= INACTIVIDAD) fantasmas.push(real);
                }

                fantasmas = [...new Set(fantasmas)];
                if (fantasmas.length === 0) continue;

                let lista = fantasmas.map(v => `👻 @${v.replace(/@.+/, "")}`).join('\n');

                let msg = `
👻 AUTO-REVISIÓN DE FANTASMAS (72H)

Grupo: ${await conn.getName(id)}

${lista}
`;

                await conn.sendMessage(id, { text: msg.trim(), mentions: fantasmas });
            }
        } catch {}
    }, INTERVAL_MS);
}