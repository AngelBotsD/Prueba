let handler = async (m, { conn, args }) => {
    if (!args || args.length === 0) return m.reply("⚠️ Falta el número. Ejemplo: .wa +52 722 758 4934 o .wa +52 7227584934 --verbose");
    const raw = args.join(" ");
    const verbose = /--verbose|--v|:v\b/i.test(raw);
    const numbers = raw.split(/\s+/).filter(x => !/--verbose|--v|:v\b/i.test(x)).map(s => s.replace(/\D/g, "")).filter(Boolean);
    if (numbers.length === 0) return m.reply("⚠️ No encontré números válidos en tu mensaje.");

    const DEFAULT_TIMEOUT = 2000;
    const RETRIES = 2;

    const delay = ms => new Promise(res => setTimeout(res, ms));

    const timeoutPromise = (p, ms, label = "timeout") => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(label)), ms))]);

    const tryWithRetries = async (fn, ms = DEFAULT_TIMEOUT, retries = RETRIES) => {
        let lastErr = null;
        for (let i = 0; i <= retries; i++) {
            try {
                return await timeoutPromise(fn(), ms, `timeout-${i}`);
            } catch (e) {
                lastErr = e;
                await delay(120 * (i + 1));
            }
        }
        throw lastErr;
    };

    const normalizeErrorMessage = e => {
        if (!e) return "";
        if (typeof e === "string") return e.toLowerCase();
        if (e?.message) return String(e.message).toLowerCase();
        if (e?.status) return String(e.status).toLowerCase();
        try { return JSON.stringify(e).toLowerCase(); } catch { return String(e).toLowerCase(); }
    };

    const classifyFromErrors = errMsgs => {
        const all = errMsgs.join(" ");
        if (!all) return null;
        if (all.includes("forbidden") || all.includes("403")) return "forbidden";
        if (all.includes("not found") || all.includes("404") || all.includes("not exist") || all.includes("not_registered")) return "not_found";
        if (all.includes("quota") || all.includes("rate") || all.includes("too many requests")) return "rate_limited";
        return "other";
    };

    const safeAttempt = async (label, fn, ms = DEFAULT_TIMEOUT) => {
        if (typeof fn !== "function") return { ok: false, missing: true, err: "method_missing" };
        try {
            const start = Date.now();
            const res = await tryWithRetries(fn, ms, RETRIES);
            const duration = Date.now() - start;
            return { ok: true, duration, res };
        } catch (e) {
            return { ok: false, err: normalizeErrorMessage(e) };
        }
    };

    const runCheckForNumber = async number => {
        const jid = number + "@s.whatsapp.net";
        const result = { number, jid, timestamp: Date.now(), steps: [], exists: false, label: null, confidence: 0, details: {} };

        const onWhatsAppAttempt = await safeAttempt("onWhatsApp", () => conn.onWhatsApp(number), DEFAULT_TIMEOUT);
        result.steps.push({ name: "onWhatsApp", ...onWhatsAppAttempt });
        if (onWhatsAppAttempt.ok) result.exists = !!(onWhatsAppAttempt.res?.[0]?.exists);

        if (!result.exists) {
            result.label = "NO_REGISTRADO";
            result.confidence = 0.98;
            return result;
        }

        const fetchStatusAttempt = await safeAttempt("fetchStatus", () => conn.fetchStatus(jid), DEFAULT_TIMEOUT);
        result.steps.push({ name: "fetchStatus", ...fetchStatusAttempt });
        const statusOk = fetchStatusAttempt.ok && fetchStatusAttempt.res?.status !== undefined;
        if (statusOk) result.details.fetchStatus = fetchStatusAttempt.res;

        const presenceAttempt = await (async () => {
            let r = await safeAttempt("requestPresenceUpdate", () => conn.requestPresenceUpdate(jid), DEFAULT_TIMEOUT);
            if (r.missing) r = await safeAttempt("presenceSubscribe", () => conn.presenceSubscribe?.(jid), DEFAULT_TIMEOUT);
            return r;
        })();
        result.steps.push({ name: "presenceProbe", ...presenceAttempt });
        const presenceOk = presenceAttempt.ok;

        const bizAttempt = await safeAttempt("getBusinessProfile", () => conn.getBusinessProfile(jid), DEFAULT_TIMEOUT);
        result.steps.push({ name: "getBusinessProfile", ...bizAttempt });
        const bizOk = bizAttempt.ok && !!bizAttempt.res;
        if (bizOk) result.details.business = bizAttempt.res;

        const picAttempt = await safeAttempt("profilePictureUrl", () => conn.profilePictureUrl?.(jid, "image").then(u => !!u), 1500);
        result.steps.push({ name: "profilePictureUrl", ...picAttempt });
        const picOk = picAttempt.ok && !!picAttempt.res;

        const errMsgs = [fetchStatusAttempt.err, presenceAttempt.err, bizAttempt.err, picAttempt.err].filter(Boolean).map(String);
        const classified = classifyFromErrors(errMsgs);

        if (statusOk || presenceOk || bizOk || picOk) {
            result.label = "ACTIVO";
            result.confidence = 0.95;
            result.details = { statusOk, presenceOk, bizOk, picOk, errMsgs };
            return result;
        }

        if (!statusOk && !presenceOk && !bizOk && !picOk) {
            if (classified === "forbidden") {
                result.label = "REVISION_TEMPORAL";
                result.confidence = 0.92;
                result.details = { errMsgs, classified };
                return result;
            }
            if (classified === "not_found") {
                result.label = "SUSPENDIDO_O_ELIMINADO";
                result.confidence = 0.9;
                result.details = { errMsgs, classified };
                return result;
            }
            result.label = "EXISTE_PERO_LIMITADO";
            result.confidence = 0.6;
            result.details = { errMsgs, classified };
            return result;
        }

        result.label = "INDETERMINADO";
        result.confidence = 0.5;
        result.details = { errMsgs, classified };
        return result;
    };

    const results = [];
    for (let i = 0; i < numbers.length; i++) {
        try {
            const r = await runCheckForNumber(numbers[i]);
            results.push(r);
        } catch (e) {
            results.push({ number: numbers[i], jid: numbers[i] + "@s.whatsapp.net", error: String(e) });
        }
    }

    const buildMessageForResult = r => {
        if (r.error) return `📱 Número: https://wa.me/${r.number}\n\n❗ Error interno: ${r.error}`;
        if (r.label === "NO_REGISTRADO") {
            return `📱 Número: https://wa.me/${r.number}\n\n❌ *NO REGISTRADO EN WHATSAPP*\n\n📌 Incluye: número no existente, revisión temporal/permanente que lo deja "no registrado", suspensión o eliminación. (Confianza ${(r.confidence*100).toFixed(0)}%)`;
        }
        if (r.label === "ACTIVO") {
            const lines = [];
            lines.push(`📱 Número: https://wa.me/${r.number}`);
            lines.push("");
            lines.push("🟢 *REGISTRADO Y ACTIVO EN WHATSAPP*");
            if (r.details.business) lines.push("🏢 Cuenta Business");
            else lines.push("👤 Cuenta personal (o no Business)");
            lines.push("");
            if (r.details.statusOk) lines.push("• Estado público: OK");
            if (r.details.presenceOk) lines.push("• Presencia: OK");
            if (r.details.bizOk) lines.push("• Business: OK");
            if (r.details.picOk) lines.push("• Foto: OK (fallback)");
            lines.push("");
            lines.push(`(Confianza ${(r.confidence*100).toFixed(0)}%)`);
            return lines.join("\n");
        }
        if (r.label === "REVISION_TEMPORAL") {
            return `📱 Número: https://wa.me/${r.number}\n\n🟡 *EN REVISIÓN TEMPORAL POR WHATSAPP*\n\n📌 Existe, pero el servidor bloquea el acceso a estado/presencia/perfil (403 / forbidden). (Confianza ${(r.confidence*100).toFixed(0)}%)`;
        }
        if (r.label === "SUSPENDIDO_O_ELIMINADO") {
            return `📱 Número: https://wa.me/${r.number}\n\n🔴 *SUSPENDIDO O ELIMINADO (PERMANENTE)*\n\n📌 Las APIs reportan recursos no disponibles (404 / not found). (Confianza ${(r.confidence*100).toFixed(0)}%)`;
        }
        if (r.label === "EXISTE_PERO_LIMITADO") {
            return `📱 Número: https://wa.me/${r.number}\n\n⚪ *EXISTE PERO NO RESPONDE COMPLETAMENTE*\n\n📌 Todas las comprobaciones secundarias fallaron, sin 403/404 claro. Posibles causas: privacidad extrema, revisión suave o inconsistencia del servidor. (Confianza ${(r.confidence*100).toFixed(0)}%)`;
        }
        if (r.label === "INDETERMINADO") {
            return `📱 Número: https://wa.me/${r.number}\n\n❓ *ESTADO INDETERMINADO*\n\n📌 Resultado ambiguo. Revisa logs internos para más detalles. (Confianza ${(r.confidence*100).toFixed(0)}%)`;
        }
        return `📱 Número: https://wa.me/${r.number}\n\n❓ *Sin clasificación*`;
    };

    for (let res of results) {
        await m.reply(buildMessageForResult(res));
        if (verbose) {
            try {
                const dbg = { number: res.number, label: res.label, confidence: res.confidence, steps: res.steps.map(s => ({ name: s.name, ok: !!s.ok, duration: s.duration || null, err: s.err || null })) };
                await m.reply("DEBUG: " + JSON.stringify(dbg, null, 2));
            } catch {}
        }
    }
};

handler.command = /^wa$/i;
export default handler;