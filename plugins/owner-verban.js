// Detector avanzado compatible con ds6/meta
// Usa múltiples capas, timeouts y retries para evitar colgones
// Resultado: { label, confidence, details }

const DEFAULT_TIMEOUT = 2000; // ms por intento
const RETRIES = 2; // reintentos cortos por comprobación

function timeoutPromise(promise, ms, label = "timeout") {
    return Promise.race([
        promise,
        new Promise((_, rej) => setTimeout(() => rej(new Error(label)), ms))
    ]);
}

async function tryWithRetries(fn, ms = DEFAULT_TIMEOUT, retries = RETRIES) {
    let lastErr = null;
    for (let i = 0; i <= retries; i++) {
        try {
            return await timeoutPromise(fn(), ms, `timeout-${i}`);
        } catch (e) {
            lastErr = e;
            // pequeño backoff
            await new Promise(r => setTimeout(r, 120 * (i + 1)));
        }
    }
    throw lastErr;
}

function normalizeErrorMessage(e) {
    if (!e) return "";
    if (typeof e === "string") return e.toLowerCase();
    if (e?.message) return String(e.message).toLowerCase();
    if (e?.status) return String(e.status).toLowerCase();
    return JSON.stringify(e).toLowerCase();
}

function classifyFromErrors(errMsgs = []) {
    const all = errMsgs.join(" ");
    if (!all) return null;
    if (all.includes("forbidden") || all.includes("403")) return "forbidden";
    if (all.includes("not found") || all.includes("404") || all.includes("not exist") || all.includes("not_registered")) return "not_found";
    if (all.includes("quota") || all.includes("rate") || all.includes("too many requests")) return "rate_limited";
    return "other";
}

let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply(`⚠️ *Falta el número*\n\n📌 Ejemplo: .wa +52 722 758 4934`);

    const raw = args.join(" ");
    const number = raw.replace(/\D/g, "");
    const jid = number + "@s.whatsapp.net";

    await m.reply(`🔍 *Analizando número en WhatsApp...*\n\nEsto no debería tardar más de 3 segundos.`);

    const result = {
        number,
        jid,
        timestamp: Date.now(),
        steps: [],
        label: null,
        confidence: 0
    };

    // --- STEP 1: onWhatsApp (existencia) ---
    try {
        const start = Date.now();
        const info = await tryWithRetries(() => conn.onWhatsApp(number), DEFAULT_TIMEOUT, 1);
        const duration = Date.now() - start;
        result.steps.push({ name: "onWhatsApp", ok: true, duration, raw: info });
        result.exists = !!(info?.[0]?.exists);
    } catch (e) {
        result.steps.push({ name: "onWhatsApp", ok: false, err: normalizeErrorMessage(e) });
        result.exists = false;
    }

    // If it doesn't exist -> no need to probe further
    if (!result.exists) {
        result.label = "NO_REGISTRADO";
        result.confidence = 0.98;
        return m.reply(
`📱 Número: https://wa.me/${number}

❌ *NO REGISTRADO EN WHATSAPP*

📌 Esto incluye:
- Número no existente
- Revisión temporal/permanente que lo deja "no registrado"
- Suspensión o eliminación permanente`
        );
    }

    // --- prepare containers for secondary probes ---
    let statusOk = false, statusErr = null, presenceOk = false, presenceErr = null;
    let bizOk = false, bizErr = null, picOk = false, picErr = null;

    // Helper to attempt method only if exists on conn
    async function safeAttempt(name, fn, ms = DEFAULT_TIMEOUT) {
        if (!fn) {
            return { ok: false, missing: true, err: "method_missing" };
        }
        try {
            const start = Date.now();
            const res = await tryWithRetries(fn, ms, RETRIES);
            const duration = Date.now() - start;
            return { ok: true, duration, res };
        } catch (e) {
            return { ok: false, err: normalizeErrorMessage(e) };
        }
    }

    // --- STEP 2: fetchStatus ---
    const st = await safeAttempt("fetchStatus", () => conn.fetchStatus(jid), DEFAULT_TIMEOUT);
    result.steps.push({ name: "fetchStatus", ...st });

    if (st.ok && st.res?.status !== undefined) statusOk = true;
    else statusErr = st.err || (st.missing ? "missing" : null);

    // --- STEP 3: requestPresenceUpdate OR presenceSubscribe ---
    // ds6/meta can expose requestPresenceUpdate or presenceSubscribe patterns; try both.
    const presenceAttempt = await (async () => {
        // try requestPresenceUpdate first
        let r = await safeAttempt("requestPresenceUpdate", () => conn.requestPresenceUpdate(jid), DEFAULT_TIMEOUT);
        if (r.missing) {
            // try presenceSubscribe then wait for a short period to see if conn emits presence (we don't rely on events here)
            r = await safeAttempt("presenceSubscribe", () => conn.presenceSubscribe?.(jid), DEFAULT_TIMEOUT);
        }
        return r;
    })();
    result.steps.push({ name: "presenceProbe", ...presenceAttempt });

    if (presenceAttempt.ok) presenceOk = true;
    else presenceErr = presenceAttempt.err || (presenceAttempt.missing ? "missing" : null);

    // --- STEP 4: getBusinessProfile ---
    const biz = await safeAttempt("getBusinessProfile", () => conn.getBusinessProfile(jid), DEFAULT_TIMEOUT);
    result.steps.push({ name: "getBusinessProfile", ...biz });
    if (biz.ok && biz.res) bizOk = true;
    else bizErr = biz.err || (biz.missing ? "missing" : null);

    // --- STEP 5: profilePicture (optional, fallback only) ---
    // NOT recommended as single source; used as a last-resort signal only if enabled on server
    const pic = await safeAttempt("profilePictureUrl", () => conn.profilePictureUrl?.(jid, "image").then(u => !!u), 1500);
    result.steps.push({ name: "profilePictureUrl", ...pic });
    if (pic.ok && pic.res) picOk = true;
    else picErr = pic.err || (pic.missing ? "missing" : null);

    // Collect error msgs
    const errMsgs = [statusErr, presenceErr, bizErr, picErr].filter(Boolean).map(s => String(s).toLowerCase());
    const classified = classifyFromErrors(errMsgs);

    // --- DECISION HEURISTICS (multi-layer) ---
    // Priority:
    // 1. If any secondary probe ok -> ACTIVE
    // 2. If all secondary probes failed and errors point to forbidden/403 -> REVISIÓN TEMPORAL
    // 3. If all failed and some point to not found/404 -> SUSPENDIDO/ELIMINADO
    // 4. If all failed but responses are mixed/other -> SEMI-ACTIVE/PRIVADO (low confidence)

    // 1) Active
    if (statusOk || presenceOk || bizOk || picOk) {
        result.label = "ACTIVO";
        result.confidence = 0.95;
        result.details = {
            statusOk, presenceOk, bizOk, picOk,
            reason: "Alguna de las capas secundarias respondió correctamente."
        };

        return m.reply(
`📱 Número: https://wa.me/${number}

🟢 *REGISTRADO Y ACTIVO EN WHATSAPP*

Detalles:
${statusOk ? "• Estado: OK\n" : ""}${presenceOk ? "• Presencia: OK\n" : ""}${bizOk ? "• Business: OK\n" : ""}${picOk ? "• Foto: OK (fallback)\n" : ""}

(Confianza: 95%)`
        );
    }

    // 2) All secondary failed -> analyze errors
    if (!statusOk && !presenceOk && !bizOk && !picOk) {
        // if errors indicate forbidden/403 -> temporal review
        if (classified === "forbidden") {
            result.label = "REVISION_TEMPORAL";
            result.confidence = 0.92;
            result.details = { errMsgs, classified, reason: "Código de error tipo 'forbidden' o 403 desde las APIs." };

            return m.reply(
`📱 Número: https://wa.me/${number}

🟡 *EN REVISIÓN TEMPORAL POR WHATSAPP*
📌 Existe, pero el servidor bloquea el acceso a estado/presencia/perfil (403 / forbidden).
✔ Esto equivale a revisión temporal / restricción momentánea.
(Confianza: 92%)`
            );
        }

        // if errors indicate not found/404 -> suspicious: suspension/deleted
        if (classified === "not_found") {
            result.label = "SUSPENDIDO_O_ELIMINADO";
            result.confidence = 0.9;
            result.details = { errMsgs, classified, reason: "APIs responden tipo 'not found' o 404 en subcaps." };

            return m.reply(
`📱 Número: https://wa.me/${number}

🔴 *SUSPENDIDO O ELIMINADO (PERMANENTE)*
📌 Aunque el registro histórico existe, las APIs reportan que los recursos no están disponibles (404/not found).
(Confianza: 90%)`
            );
        }

        // else: mixed unknown errors — probable revisión suave / privacidad alta
        result.label = "EXISTE_PERO_LIMITADO";
        result.confidence = 0.6;
        result.details = { errMsgs, classified, reason: "Todas las capas fallaron pero sin error claro; puede ser privacidad extrema, revisión suave o inconsistencia del servidor." };

        return m.reply(
`📱 Número: https://wa.me/${number}

⚪ *EXISTE PERO NO RESPONDE COMPLETAMENTE*
📌 Todas las comprobaciones secundarias fallaron, pero no hay un 403/404 claro.
Posibles causas:
 - Privacidad extrema del usuario
 - Revisión suave / transición
 - Errores intermitentes del servidor

(Confianza baja-moderada: 60%)`
        );
    }

    // Fallback (should not reach)
    result.label = result.label || "INDETERMINADO";
    result.confidence = result.confidence || 0.5;
    return m.reply(
`📱 Número: https://wa.me/${number}

❓ *ESTADO INDETERMINADO*
📌 Resultado ambiguo. Revisa logs internos para más detalles.`
    );
};

handler.command = /^wa$/i;
export default handler;