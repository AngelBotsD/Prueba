import util from "util"

let handler = async (m, { conn, args }) => {

    if (!args[0])
        return m.reply("⚠️ Escribe un número.\nEjemplo: *.baninfo +52 722 758 4934*")

    // Normalizar número
    let num = args[0].replace(/[^0-9]/g, "")
    if (!num) return m.reply("⚠️ Número inválido.")

    try {
        // Consulta directa al endpoint de verificación del estado
        let res = await conn.query({
            tag: "iq",
            attrs: { xmlns: "w:auth:verify", to: "s.whatsapp.net" },
            content: [
                { tag: "verify", attrs: { login: num } }
            ]
        })

        let raw = parseResponseRaw(res)
        let analysis = analyzeBanStatus(raw)

        let output = {
            raw_status: raw,
            analysis
        }

        await conn.sendMessage(m.chat, {
            text: "📊 *Estado del número:*\n\n```" + util.format(output) + "```"
        })

    } catch (e) {
        console.log("ERROR baninfo:", e)
        return m.reply("⚠️ Error al consultar el número.")
    }
}

handler.command = /^baninfo$/i
export default handler


// ===========================
//   CONVERTIR RESPUESTA RAW
// ===========================
function parseResponseRaw(res) {
    let v = res?.content?.[0]?.attrs || {}

    return {
        banned: v.status === "fail",
        reason: v.reason || null,
        login: v.login || null,
        status: v.status || null,
        violation_type: v.violation_type ? Number(v.violation_type) : null
    }
}


// ===========================
//    ANÁLISIS PROFESIONAL
// ===========================
function analyzeBanStatus(raw) {
    let out = {
        estado: "",
        tipo_ban: "",
        explicacion: "",
        riesgo: "",
        recomendacion: ""
    }

    // NÚMERO ACTIVO
    if (!raw.banned && raw.status === "ok") {
        out.estado = "🟢 Número activo"
        out.tipo_ban = "Ninguno"
        out.explicacion = "El número está completamente funcional."
        return out
    }

    // BANEADO PERMANENTE
    if (raw.banned && raw.violation_type >= 10 && raw.violation_type < 20) {
        out.estado = "🔴 Baneado permanentemente"
        out.tipo_ban = "Permanente"
        out.explicacion = explainReason(raw)
        out.riesgo = explainViolationType(raw.violation_type)
        out.recomendacion = "No se puede recuperar este número."
        return out
    }

    // BAN TEMPORAL (REVIEW / SUSPENSIÓN)
    if (raw.banned && (raw.violation_type >= 20 && raw.violation_type < 40)) {
        out.estado = "🟠 Baneo temporal / Revisión"
        out.tipo_ban = "Temporal"
        out.explicacion = explainReason(raw)
        out.riesgo = explainViolationType(raw.violation_type)
        out.recomendacion = "Esperar de 12 a 48 horas. Puede recuperarse."
        return out
    }

    // RIESGO / SHADOWBAN
    if (!raw.banned && (raw.violation_type >= 40)) {
        out.estado = "🟡 Número en riesgo"
        out.tipo_ban = "Advertencia"
        out.explicacion = "El número presenta actividad sospechosa."
        out.riesgo = explainViolationType(raw.violation_type)
        out.recomendacion = "Reducir envíos masivos y evitar SPAM."
        return out
    }

    // DESCONOCIDO
    out.estado = "⚪ Estado desconocido"
    out.explicacion = "Meta devolvió un estado no clasificado."
    return out
}


// ===========================
//       DETALLES
// ===========================
function explainReason(raw) {
    if (!raw.reason) return "Meta no envió descripción del motivo."

    const map = {
        "Fraud (media/text)": "El número fue marcado por actividades fraudulentas con texto o multimedia.",
        "Spam": "Actividad de spam detectada.",
        "Too many attempts": "Demasiados intentos fallidos.",
    }

    return map[raw.reason] || raw.reason
}

function explainViolationType(code) {
    if (code === null) return "Sin código de violación."

    if (code === 14) return "Tipo 14 → Fraude detectado (mensajes / multimedia). Baneo permanente."

    if (code >= 10 && code < 20) return `Tipo ${code} → Violación grave (baneado permanente).`
    if (code >= 20 && code < 30) return `Tipo ${code} → Actividad sospechosa, baneo temporal.`
    if (code >= 30 && code < 40) return `Tipo ${code} → Revisión manual en curso.`
    if (code >= 40) return `Tipo ${code} → Número con comportamiento riesgoso.`

    return "Código no documentado."
}