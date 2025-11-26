// play-handler.js
import axios from "axios";
import yts from "yt-search";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { promisify } from "util";
import { pipeline } from "stream";
import crypto from "crypto";

const streamPipe = promisify(pipeline);
const TMP_DIR = path.join(process.cwd(), "tmp");
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const CACHE_FILE = path.join(TMP_DIR, "cache.json");
const SKY_BASE = process.env.API_BASE || "https://api-sky.ultraplus.click";
const SKY_KEY = process.env.API_KEY || "Neveloopp";

const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT) || 8;
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB) || 99;
const DOWNLOAD_TIMEOUT = Number(process.env.DOWNLOAD_TIMEOUT) || 60000;
const MAX_RETRIES = Number(process.env.MAX_RETRIES) || 5;

const CLEAN_INTERVAL = 1000 * 60 * 60 * 24 * 8; // 8 días
const TTL = CLEAN_INTERVAL;

let activeDownloads = 0;
const downloadQueue = [];
const downloadTasks = {};
let cache = loadCache();
const pending = {};
let metrics = { totalDownloads: 0, totalErrors: 0 };

global.playPreviewListeners ??= {};
global.PLAY_LISTENER_SET ??= {};

/* ---------------------------
   UTILIDADES (cache, archivos)
   --------------------------- */
function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch (e) {
    console.error("saveCache:", e);
  }
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) || {};
  } catch {
    return {};
  }
}

function safeUnlink(file) {
  try {
    if (file && fs.existsSync(file)) fs.unlinkSync(file);
  } catch (e) {
    console.error("safeUnlink", e);
  }
}

function fileSizeMB(filePath) {
  try {
    return fs.statSync(filePath).size / (1024 * 1024);
  } catch {
    return 0;
  }
}

function readHeader(file, length = 16) {
  try {
    const fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(length);
    fs.readSync(fd, buf, 0, length, 0);
    fs.closeSync(fd);
    return buf;
  } catch {
    return null;
  }
}

function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

/* ---------------------------
   VALIDACIÓN DE CACHE
   --------------------------- */
function validCache(file, expectedSize = null) {
  if (!file || !fs.existsSync(file)) return false;
  const size = fs.statSync(file).size;
  if (size < 50 * 1024) return false; // al menos 50KB

  if (expectedSize && size < expectedSize * 0.92) return false;

  const buf = readHeader(file, 16);
  if (!buf) return false;
  const hex = buf.toString("hex");

  if (file.endsWith(".mp3") && !(hex.startsWith("494433") || hex.startsWith("fff"))) return false; // ID3 o frame sync
  if ((file.endsWith(".mp4") || file.endsWith(".m4a")) && !hex.includes("66747970")) return false; // 'ftyp'
  return true;
}

/* ---------------------------
   COLA DE DESCARGAS (concurrency)
   --------------------------- */
async function queueDownload(task) {
  if (activeDownloads >= MAX_CONCURRENT) {
    await new Promise((res) => downloadQueue.push(res));
  }
  activeDownloads++;
  try {
    return await task();
  } finally {
    activeDownloads--;
    if (downloadQueue.length) downloadQueue.shift()();
  }
}

/* ---------------------------
   SKY API helpers
   --------------------------- */
async function getSkyApiUrl(videoUrl, format, timeout = 20000, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const { data } = await axios.get(`${SKY_BASE}/api/download/yt.php`, {
        params: { url: videoUrl, format },
        headers: { Authorization: `Bearer ${SKY_KEY}` },
        timeout,
      });

      const url =
        data?.data?.audio ||
        data?.data?.video ||
        data?.audio ||
        data?.video ||
        data?.url ||
        data?.download;
      if (url?.startsWith("http")) return url;
    } catch (e) {
      // ignore, retry below
    }
    if (i < retries) await wait(500 * (i + 1));
  }
  return null;
}

async function probeRemote(url, timeout = 10000) {
  try {
    const res = await axios.head(url, { timeout, maxRedirects: 5 });
    return { ok: true, size: Number(res.headers["content-length"] || 0), headers: res.headers };
  } catch {
    return { ok: false };
  }
}

/* ---------------------------
   DESCARGA con progreso
   --------------------------- */
async function downloadWithProgress(url, filePath, signal, start = 0) {
  const headers = start ? { Range: `bytes=${start}-` } : {};
  const res = await axios.get(url, {
    responseType: "stream",
    timeout: DOWNLOAD_TIMEOUT,
    headers,
    signal,
    maxRedirects: 5,
  });
  await streamPipe(res.data, fs.createWriteStream(filePath, { flags: start ? "a" : "w" }));
  return filePath;
}

async function convertToMp3(inputFile) {
  const outFile = inputFile.replace(path.extname(inputFile), ".mp3");
  await new Promise((resolve, reject) =>
    ffmpeg(inputFile)
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .format("mp3")
      .on("end", resolve)
      .on("error", reject)
      .save(outFile)
  );
  safeUnlink(inputFile);
  return outFile;
}

/* ---------------------------
   GESTIÓN DE TAREAS (prevent duplicate downloads)
   --------------------------- */
function taskKey(videoUrl, format) {
  return `${videoUrl}::${format}`;
}

function ensureTask(videoUrl, format) {
  const k = taskKey(videoUrl, format);
  if (!downloadTasks[k]) {
    downloadTasks[k] = { status: null, controller: null, meta: null, promise: null, file: null };
  }
  return downloadTasks[k];
}

async function startDownload(videoUrl, format, mediaUrl, forceRestart = false, retryCount = 0) {
  const k = taskKey(videoUrl, format);
  const tasks = ensureTask(videoUrl, format);

  // Si ya está descargando, devuelve la promesa
  if (tasks.status === "downloading" && tasks.promise) return tasks.promise;
  if (!forceRestart && tasks.status === "done" && tasks.file && fs.existsSync(tasks.file)) return tasks.file;

  const ext = format === "audio" ? "mp3" : "mp4";
  const tmpExt = format === "audio" ? ".audio.tmp" : ".video.tmp";
  const tmpFile = path.join(TMP_DIR, `${crypto.randomUUID()}${tmpExt}`);
  const outFile = tmpFile.replace(tmpExt, `.${ext}`);

  const controller = new AbortController();
  const info = { file: null, status: "downloading", controller, promise: null, meta: { tmpFile, outFile } };

  tasks.status = "downloading";
  tasks.controller = controller;
  tasks.meta = info.meta;

  // crear la promesa de la tarea y guardarla en tasks.promise
  tasks.promise = (async () => {
    try {
      console.log(`startDownload start ${videoUrl} ${format} tmp=${tmpFile}`);

      if (forceRestart && tasks.file) {
        try {
          safeUnlink(tasks.file);
        } catch {}
        delete tasks.file;
      }

      const probe = await probeRemote(mediaUrl);
      const expectedSize = probe.ok && probe.size ? probe.size : null;

      // descarga (cola / concurrency)
      await queueDownload(() => downloadWithProgress(mediaUrl, tmpFile, controller.signal, 0));

      if (format === "audio") {
        try {
          const hdr = readHeader(tmpFile, 4);
          const hex = hdr ? hdr.toString("hex") : "";
          if (hex.startsWith("494433") || hex.startsWith("fff")) {
            fs.renameSync(tmpFile, outFile);
            info.file = outFile;
          } else {
            info.file = await convertToMp3(tmpFile);
          }
        } catch (e) {
          // si convertir falla, intenta usar el tmp si existe
          if (fs.existsSync(tmpFile)) info.file = tmpFile;
          else throw e;
        }
      } else {
        try {
          fs.renameSync(tmpFile, outFile);
          info.file = outFile;
        } catch (e) {
          info.file = tmpFile;
        }
      }

      // validaciones
      if (!validCache(info.file, expectedSize)) {
        safeUnlink(info.file);
        if (retryCount < MAX_RETRIES && !controller.signal.aborted) {
          // reiniciar con forceRestart true
          return await startDownload(videoUrl, format, mediaUrl, true, retryCount + 1);
        }
        throw new Error("Archivo inválido después de descargar");
      }

      if (fileSizeMB(info.file) > MAX_FILE_MB) {
        safeUnlink(info.file);
        throw new Error("Archivo demasiado grande");
      }

      info.status = "done";
      tasks.status = "done";
      tasks.file = info.file;

      if (cache[videoUrl]) cache[videoUrl].time = Date.now();
      saveCache();

      console.log(`startDownload done ${videoUrl} ${format} file=${info.file}`);
      return info.file;
    } catch (err) {
      info.status = "error";
      tasks.status = "error";
      safeUnlink(info.file);
      safeUnlink(tmpFile);
      metrics.totalErrors++;
      console.error("startDownload error:", err);

      if (retryCount < MAX_RETRIES && !controller.signal.aborted) {
        return await startDownload(videoUrl, format, mediaUrl, true, retryCount + 1);
      }
      throw err;
    }
  })();

  downloadTasks[k] = tasks;
  return tasks.promise;
}

/* ---------------------------
   ENVIAR ARCHIVO AL CHAT
   --------------------------- */
async function sendFileToChat(conn, chatId, filePath, title, asDocument, type, quoted) {
  if (!validCache(filePath)) {
    return await conn.sendMessage(chatId, { text: "❌ Archivo inválido." }, { quoted });
  }
  const buffer = fs.readFileSync(filePath);
  const msg = {};
  if (asDocument) msg.document = buffer;
  else if (type === "audio") msg.audio = buffer;
  else msg.video = buffer;

  const mimetype = type === "audio" ? "audio/mpeg" : "video/mp4";
  const safeTitle = (title || "file").replace(/[/\\?%*:|"<>]/g, ""); // pequeño saneamiento
  const fileName = `${safeTitle}.${type === "audio" ? "mp3" : "mp4"}`;

  await conn.sendMessage(chatId, { ...msg, mimetype, fileName }, { quoted });
}

/* ---------------------------
   HANDLER PRINCIPAL (play & clean)
   --------------------------- */
const handler = async (msg, { conn, text, command }) => {
  const pref = global.prefixes?.[0] || ".";
  if (msg.__playProcessed) return (msg.__playProcessed = true);
  if (msg?.message?.reactionMessage) return;
  if (msg?.message?.protocolMessage) return;
  if (msg?.key?.remoteJid === "status@broadcast") return;

  if (command === "clean") {
    let deleted = 0;
    let freed = 0;
    Object.values(cache).forEach((data) =>
      Object.values(data.files || {}).forEach((f) => {
        if (f && fs.existsSync(f)) {
          try {
            freed += fs.statSync(f).size;
          } catch {}
          safeUnlink(f);
          deleted++;
        }
      })
    );

    fs.readdirSync(TMP_DIR).forEach((f) => {
      const full = path.join(TMP_DIR, f);
      if (fs.existsSync(full)) {
        try {
          freed += fs.statSync(full).size;
        } catch {}
        safeUnlink(full);
        deleted++;
      }
    });

    cache = {};
    saveCache();

    return await conn.sendMessage(
      msg.chat,
      {
        text: `🧹 Limpieza PRO\nEliminados: ${deleted}\nEspacio liberado: ${(freed / 1024 / 1024).toFixed(2)} MB`,
      },
      { quoted: msg }
    );
  }

  if (!text?.trim())
    return await conn.sendMessage(
      msg.key.remoteJid,
      { text: `✳️ Usa:\n${pref}play <término>\nEj: ${pref}play bad bunny diles` },
      { quoted: msg }
    );

  try {
    await conn.sendMessage(msg.key.remoteJid, { react: { text: "🕒", key: msg.key } });
  } catch {}

  let res;
  try {
    res = await yts(text);
  } catch {
    return await conn.sendMessage(msg.key.remoteJid, { text: "❌ Error al buscar video." }, { quoted: msg });
  }

  const video = res.videos?.[0];
  if (!video) return await conn.sendMessage(msg.key.remoteJid, { text: "❌ Sin resultados." }, { quoted: msg });

  const { url: videoUrl, title, timestamp: duration, views, author, thumbnail } = video;
  const caption = `🎵 Título: ${title}\n🕑 Duración: ${duration}\n👁️‍🗨️ Vistas: ${(views || 0).toLocaleString()}\n🎤 Artista: ${
    author?.name || author || "Desconocido"
  }\n🌐 Link: ${videoUrl}\n\n📥 Reacciona:\n☛ 👍 Audio MP3\n☛ ❤️ Video MP4\n☛ 📄 Audio Doc\n☛ 📁 Video Doc`;

  const preview = await conn.sendMessage(msg.key.remoteJid, { image: { url: thumbnail }, caption }, { quoted: msg });

  pending[preview.key.id] = {
    chatId: msg.key.remoteJid,
    videoUrl,
    title,
    commandMsg: msg,
    sender: msg.key.participant || msg.participant,
    lock: false,
    time: Date.now(),
    listener: null,
    previewId: preview.key.id,
  };

  cache[videoUrl] = cache[videoUrl] || { time: Date.now(), files: {} };
  saveCache();

  try {
    await conn.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } });
  } catch {}

  const previewId = preview.key.id;

  // limpiar listener anterior si existe
  if (global.PLAY_LISTENER_SET[previewId]) {
    try {
      conn.ev.off("messages.upsert", global.PLAY_LISTENER_SET[previewId]);
    } catch (e) {}
    delete global.PLAY_LISTENER_SET[previewId];
  }

  const listener = async (ev) => {
    for (const m of ev.messages || []) {
      try {
        // reacciones rápidas (reactionMessage)
        const react = m.message?.reactionMessage;
        if (react) {
          const job = pending[react.key?.id];
          if (!job) continue;
          const senderId = react.sender || m.key.participant || m.key?.remoteJid;
          if (senderId !== job.sender) continue;
          if (job.lock) continue;

          job.lock = true;
          try {
            // quitar listener global antes de procesar
            try {
              conn.ev.off("messages.upsert", listener);
            } catch (e) {}
            if (global.PLAY_LISTENER_SET[job.previewId]) delete global.PLAY_LISTENER_SET[job.previewId];
            if (global.playPreviewListeners[job.previewId]) delete global.playPreviewListeners[job.previewId];
            job.listener = null;
            await handleDownload(conn, job, react.text);
          } finally {
            job.lock = false;
          }
          continue;
        }

        // texto en respuesta (citado)
        const context = m.message?.extendedTextMessage?.contextInfo;
        const citado = context?.stanzaId;
        const texto = (m.message?.conversation || m.message?.extendedTextMessage?.text || "").toLowerCase().trim();

        if (citado && pending[citado]) {
          const job = pending[citado];
          if (job.lock) {
            try {
              await conn.sendMessage(m.key.remoteJid, { text: "⚠️ Ya hay una descarga en curso para este pedido." }, { quoted: m });
            } catch (e) {}
            continue;
          }

          const audioKeys = ["1", "audio", "4", "audiodoc"];
          const videoKeys = ["2", "video", "3", "videodoc"];

          if (audioKeys.includes(texto) || videoKeys.includes(texto)) {
            job.lock = true;
            try {
              conn.ev.off("messages.upsert", listener);
            } catch (e) {}
            if (global.PLAY_LISTENER_SET[job.previewId]) delete global.PLAY_LISTENER_SET[job.previewId];
            if (global.playPreviewListeners[job.previewId]) delete global.playPreviewListeners[job.previewId];
            job.listener = null;
            try {
              if (audioKeys.includes(texto)) {
                await handleDownload(conn, job, "1");
              } else {
                await handleDownload(conn, job, "2");
              }
            } finally {
              job.lock = false;
            }
          } else {
            await conn.sendMessage(
              m.key.remoteJid,
              { text: "⚠️ Opciones válidas: 1/audio,4/audiodoc → audio; 2/video,3/videodoc → video" },
              { quoted: m }
            );
          }
        }
      } catch (e) {
        console.error("listener error:", e);
      }
    }
  };

  pending[previewId].listener = listener;
  global.playPreviewListeners[previewId] = listener;
  global.PLAY_LISTENER_SET[previewId] = listener;
  conn.ev.on("messages.upsert", listener);

  // limpiar pending automáticamente después de TTL
  setTimeout(() => {
    if (pending[previewId]) {
      try {
        conn.ev.off("messages.upsert", pending[previewId].listener);
      } catch (e) {}
      delete pending[previewId];
      if (global.playPreviewListeners[previewId]) delete global.playPreviewListeners[previewId];
      if (global.PLAY_LISTENER_SET[previewId]) delete global.PLAY_LISTENER_SET[previewId];
    }
  }, TTL);
};

/* ---------------------------
   MANEJO DE DESCARGAS (rutinas)
   --------------------------- */
async function handleDownload(conn, job, choice) {
  const mapping = { "👍": "audio", "❤️": "video", "📄": "audioDoc", "📁": "videoDoc", "1": "audio", "2": "video" };
  const key = mapping[choice];
  if (!key) return;
  const isDoc = key.endsWith("Doc");

  await conn.sendMessage(job.chatId, { text: `⏳ Descargando ${isDoc ? "documento" : key.startsWith("audio") ? "audio" : "video"}…` }, { quoted: job.commandMsg });

  const videoUrl = job.videoUrl;
  const cachedFile = cache[videoUrl]?.files?.[key.startsWith("audio") ? "audio" : "video"];
  if (cachedFile && fs.existsSync(cachedFile) && validCache(cachedFile)) {
    try {
      await conn.sendMessage(job.chatId, { react: { text: "⚡", key: job.commandMsg.key } });
    } catch (e) {}
    await sendFileToChat(conn, job.chatId, cachedFile, job.title, isDoc, key.startsWith("audio") ? "audio" : "video", job.commandMsg);
    try {
      await conn.sendMessage(job.chatId, { react: { text: "✅", key: job.commandMsg.key } });
    } catch (e) {}
    cleanupPendingByJob(job, conn);
    return;
  }

  if (key.startsWith("audio")) await downloadAudio(conn, job, isDoc, job.commandMsg);
  else await downloadVideo(conn, job, isDoc, job.commandMsg);
}

async function downloadAudio(conn, job, asDocument, quoted) {
  const { chatId, videoUrl, title } = job;
  const cached = cache[videoUrl]?.files?.audio;
  if (cached && fs.existsSync(cached) && validCache(cached)) {
    try {
      await conn.sendMessage(chatId, { react: { text: "⚡", key: quoted.key } });
    } catch (e) {}
    await sendFileToChat(conn, chatId, cached, title, asDocument, "audio", quoted);
    try {
      await conn.sendMessage(chatId, { react: { text: "✅", key: quoted.key } });
    } catch (e) {}
    cleanupPendingByJob(job, conn);
    return;
  }

  const data = await getSkyApiUrl(videoUrl, "audio");
  if (!data) return conn.sendMessage(chatId, { text: "❌ No se pudo obtener audio." }, { quoted });

  try {
    const tasks = ensureTask(videoUrl, "audio");
    let file = null;

    if (tasks.status === "done" && tasks.file && fs.existsSync(tasks.file) && validCache(tasks.file)) {
      file = tasks.file;
    } else if (tasks.status === "downloading" && tasks.promise) {
      try {
        file = await tasks.promise;
      } catch (e) {
        console.error("Error esperando descarga previa audio:", e);
      }
    }

    if (!file) {
      metrics.totalDownloads++;
      const started = startDownload(videoUrl, "audio", data, false, 0);
      file = await started;
    }

    if (!file || !fs.existsSync(file)) {
      console.error("downloadAudio -> archivo no existe después de startDownload:", file);
      return conn.sendMessage(chatId, { text: "❌ Falló la descarga final." }, { quoted });
    }

    if (!validCache(file)) {
      console.error("downloadAudio -> archivo descargado inválido:", file);
      return conn.sendMessage(chatId, { text: "❌ Archivo inválido después de descargar." }, { quoted });
    }

    if (fileSizeMB(file) > MAX_FILE_MB) return conn.sendMessage(chatId, { text: `❌ Archivo >${MAX_FILE_MB}MB` }, { quoted });

    await sendFileToChat(conn, chatId, file, title, asDocument, "audio", quoted);

    cache[videoUrl] = cache[videoUrl] || { time: Date.now(), files: {} };
    cache[videoUrl].time = Date.now();
    cache[videoUrl].files.audio = file;
    saveCache();

    cleanupPendingByJob(job, conn);
  } catch (err) {
    console.error("downloadAudio error:", err);
    await conn