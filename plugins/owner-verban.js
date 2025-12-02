import axios from "axios"
import fs from "fs"

// Base de datos local
const DB_PATH = "./database/numvirtual.json"

// Países disponibles
const COUNTRIES = {
    ES: {
        name: "España",
        prefix: "+34",
        url: "https://ejemplo.com/spain_numbers.json"
    },

    AR: {
        name: "Argentina",
        prefix: "+54",
        url: "https://ejemplo.com/argentina_numbers.json"
    },

    NL: {
        name: "Países Bajos",
        prefix: "+31",
        url: "https://ejemplo.com/netherlands_numbers.json"
    }
}

// Polling + timers
let userPolling = new Set()
let autoRotateTimers = {}


// Cargar DB
async function loadDB() {
    if (!fs.existsSync(DB_PATH)) return {}
    return JSON.parse(fs.readFileSync(DB_PATH))
}

// Guardar DB
async function saveDB(db) {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
}


// Obtener números disponibles de un país
async function fetchCountryNumbers(countryCode) {
    try {
        const { data } = await axios.get(COUNTRIES[countryCode].url)
        return data
    } catch (e) {
        return []
    }
}


// Polling cada 2 seg
async function startPolling(conn, userId, countryCode, phoneNumber) {
    if (userPolling.has(userId)) return
    userPolling.add(userId)

    const check = async () => {
        try {
            const sms = await axios.get(`https://sms.apiadonix.space/messages?phone=${phoneNumber}`)
            const db = await loadDB()

            if (!db[userId]) return

            if (!Array.isArray(sms.data) || sms.data.length === 0) return

            const lastMessage = sms.data[sms.data.length - 1]

            // Revisar repetidos
            if (db[userId].history?.includes(lastMessage.id)) return

            db[userId].history.push(lastMessage.id)
            await saveDB(db)

            await conn.sendMessage(userId, {
                text: `📩 *Nuevo SMS Recibido*\n\n*De:* ${lastMessage.sender || "Desconocido"}\n\n📨 *Mensaje:* ${lastMessage.message}`
            })

        } catch { }
    }

    const loop = async () => {
        if (!userPolling.has(userId)) return
        await check()
        setTimeout(loop, 2000)
    }

    loop()
}


// Auto rotación cada 3 minutos
async function startAutoRotate(conn, userId, countryCode) {
    if (autoRotateTimers[userId]) return

    autoRotateTimers[userId] = setInterval(async () => {
        const db = await loadDB()
        if (!db[userId]) return

        // Números del país
        const rawNumbers = await fetchCountryNumbers(countryCode)
        let available = rawNumbers.map(n => String(n))

        // Quitar el número actual y evitar duplicados
        const current = db[userId].number.replace(COUNTRIES[countryCode].prefix, "")
        available = available.filter(n => n !== current)

        if (available.length === 0) return

        // Nuevo número
        const newRaw = available[Math.floor(Math.random() * available.length)]
        const newFull = COUNTRIES[countryCode].prefix + newRaw

        // Actualizar
        db[userId].number = newFull
        db[userId].history = []
        db[userId].assignedAt = new Date().toISOString()
        await saveDB(db)

        // Detener polling viejo
        userPolling.delete(userId)

        // Mensaje
        await conn.sendMessage(userId, {
            text: `🔄 *Tu número ha sido rotado automáticamente*\n\n📱 Nuevo número: *${newFull}*`
        })

        // Nuevo polling
        startPolling(conn, userId, countryCode, newFull)
    }, 3 * 60 * 1000)
}


// Mensaje bonito
function countrySelection() {
    return `🌍 *Selecciona un país para obtener un número virtual:*\n\n` +
        `🇪🇸 *1.* España\n` +
        `🇦🇷 *2.* Argentina\n` +
        `🇳🇱 *3.* Países Bajos\n\n` +
        `Escribe el número del país.`
}


// Handler principal
let handler = async (m, { conn, args }) => {
    const userId = m.sender

    // Elegir país
    if (!args[0]) {
        return m.reply(countrySelection())
    }

    const option = args[0]
    let countryCode = null

    if (option === "1") countryCode = "ES"
    if (option === "2") countryCode = "AR"
    if (option === "3") countryCode = "NL"

    if (!countryCode) return m.reply(`❌ Opción inválida.\n\n` + countrySelection())

    // Cargar números
    const numbers = await fetchCountryNumbers(countryCode)
    if (numbers.length === 0) return m.reply(`❌ No hay números disponibles para ${COUNTRIES[countryCode].name}.`)

    // Base de datos
    const db = await loadDB()

    // Evitar duplicados entre usuarios
    const used = Object.values(db).map(u => u.number?.replace(COUNTRIES[countryCode].prefix, ""))
    const available = numbers.filter(n => !used.includes(String(n)))

    if (available.length === 0) return m.reply(`❌ No queda ningún número disponible ahora mismo.`)

    // Elegir número
    const raw = available[Math.floor(Math.random() * available.length)]
    const fullNumber = COUNTRIES[countryCode].prefix + raw

    // Guardar
    db[userId] = {
        number: fullNumber,
        country: countryCode,
        assignedAt: new Date().toISOString(),
        history: []
    }

    await saveDB(db)

    // Mensaje
    await conn.sendMessage(userId, {
        text: `🎉 *Número asignado exitosamente*\n\n` +
            `🌍 País: *${COUNTRIES[countryCode].name}*\n` +
            `📱 Número: *${fullNumber}*\n\n` +
            `A partir de ahora recibirás los SMS aquí.`
    })

    // Iniciar polling y auto-rotación
    startPolling(conn, userId, countryCode, fullNumber)
    startAutoRotate(conn, userId, countryCode)
}

handler.command = ['sms'] 
export default handler