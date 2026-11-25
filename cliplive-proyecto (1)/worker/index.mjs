// Worker de captura: toma trabajos de la base de datos (Supabase), graba el directo con yt-dlp + ffmpeg y sube el archivo a Supabase Storage.
// Requiere en el PATH: yt-dlp, ffmpeg y un runtime de JS (Deno) para YouTube. Ver README.
import { loudnessPerSecond, heatPerSecond, pickMoments } from "./highlights.mjs";
import { videoSize, cropSize, fixedX, faceTimeline, planCamera, faceBoxesFn, sendcmdFile, faceModelAvailable } from "./framing.mjs";
import { buildAss, parseWhisperWords, DEFAULT_CAPTION } from "./captions.mjs";
import { createClient } from "@supabase/supabase-js";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { probeMedia, youtubeBlocked } from "../src/lib/media-probe.mjs";

const run = promisify(execFile);

// En Render los programas (yt-dlp, ffmpeg, deno) se instalan en ./bin: se añade al PATH para encontrarlos.
if (existsSync(join(process.cwd(), "bin"))) process.env.PATH = join(process.cwd(), "bin") + (process.platform === "win32" ? ";" : ":") + process.env.PATH;
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BUCKET = process.env.STORAGE_BUCKET || "clips";
const YOUTUBE_MODE = process.env.YOUTUBE_WORKER_MODE || "direct";
const PLATFORMS = YOUTUBE_MODE === "external" ? ["twitch", "kick", "tiktok", "file"]
  : YOUTUBE_MODE === "youtube-only" ? ["youtube"] : null;
const YOUTUBE_ERROR = "YouTube rechazó la descarga desde el servidor. Inténtalo en unos minutos.";
const CRF = ["-c:v", "libx264", "-preset", "superfast", "-crf", "23", "-c:a", "aac", "-movflags", "+faststart"];
const CROP = { "9:16": "crop=ih*9/16:ih", "1:1": "crop=min(iw\\,ih):min(iw\\,ih)", "16:9": null };
const MIME = { mp4: "video/mp4", mp3: "audio/mpeg", jpg: "image/jpeg" };

// ── Progreso visible en la web (clips.progress 0-100 y clips.stage) ──
const noop = async () => {};
function progressFor(clipId) {
  let last = { pct: -1, stage: "", at: 0 };
  return async (pct, stage) => {
    pct = Math.max(0, Math.min(99, Math.round(pct)));
    const now = Date.now();
    if (stage === last.stage && (pct - last.pct < 3 || now - last.at < 1500)) return;   // no saturar la base de datos
    last = { pct, stage, at: now };
    await db.from("clips").update({ progress: pct, stage }).eq("id", clipId);
  };
}
// Avance estimado mientras dura una tarea sin porcentaje propio (descargas y grabaciones).
function estimate(prog, from, to, seconds, stage, linear = false) {
  const t0 = Date.now();
  prog(from, stage);
  const timer = setInterval(() => {
    const k = (Date.now() - t0) / 1000 / Math.max(1, seconds);
    prog(from + (to - from) * (linear ? Math.min(1, k) : 1 - Math.exp(-2 * k)), stage);
  }, 1000);
  return () => clearInterval(timer);
}
// yt-dlp con porcentaje de descarga (lee las líneas "[download]  42.3%").
function ytdlpProgress(args, { onPct, timeout }) {
  return new Promise((resolve, reject) => {
    const p = spawn("yt-dlp", ["--newline", ...args]);
    let err = "";
    const kill = setTimeout(() => p.kill("SIGKILL"), timeout);
    const onData = (d) => {
      const m = String(d).match(/\[download\]\s+([\d.]+)%/g);
      if (m) onPct(Math.min(1, parseFloat(m[m.length - 1].replace(/[^\d.]/g, "")) / 100));
    };
    p.stdout.on("data", onData);
    p.stderr.on("data", (d) => { onData(d); err = (err + d).slice(-4000); });
    p.on("error", reject);
    p.on("close", (code) => { clearTimeout(kill); code === 0 ? resolve() : reject(new Error(`yt-dlp: ${err.trim().split("\n").pop()}`)); });
  });
}
// Progreso de una búsqueda de momentos (auto_jobs.progress / stage), sin saturar la base de datos.
function autoProgressFor(autoId) {
  let last = { pct: -1, stage: "", at: 0 };
  return async (pct, stage) => {
    pct = Math.max(0, Math.min(99, Math.round(pct)));
    const now = Date.now();
    if (stage === last.stage && (pct - last.pct < 2 || now - last.at < 2000)) return;
    last = { pct, stage, at: now };
    await db.from("auto_jobs").update({ progress: pct, stage }).eq("id", autoId);
  };
}

// ── Directos de YouTube: el historial (DVR) se lee de la lista HLS del directo ──
// yt-dlp no puede cortar un trozo del pasado de un directo de YouTube ("This format cannot be partially
// downloaded"), pero la lista HLS guarda ~1 h hacia atrás: ffmpeg -live_start_index empieza N segmentos antes.
async function youtubeHls(info, maxHeight = 1080) {
  const m3u8 = (info.formats ?? []).filter((x) => String(x.protocol).startsWith("m3u8"));
  const video = m3u8.filter((x) => x.height && x.height <= maxHeight).sort((a, b) => b.height - a.height)[0]
    ?? m3u8.filter((x) => x.height).sort((a, b) => a.height - b.height)[0];
  const audio = m3u8.filter((x) => !x.height && x.acodec !== "none")[0];
  if (!video) throw new Error("El directo no tiene lista HLS");
  const pl = await (await fetch(video.url, { signal: AbortSignal.timeout(15_000) })).text();
  const durs = [...pl.matchAll(/#EXTINF:([\d.]+)/g)].map((m) => Number(m[1]));
  return { video, audio, seg: durs[0] || 5, total: durs.reduce((x, y) => x + y, 0) };
}
// Descarga desde (ahora - back) durante len segundos. untilNow: solo hasta el momento actual (para analizar).
async function grabYoutubePast(info, { back, len, untilNow = false, audioOnly = false, maxHeight = 480, out, onPct = () => {} }) {
  const h = await youtubeHls(info, maxHeight);
  const b = Math.max(h.seg, Math.min(back, h.total - h.seg));          // no más atrás de lo que guarda YouTube
  const L = untilNow ? b : len;
  const idx = String(-Math.ceil(b / h.seg));
  const inputs = audioOnly
    ? ["-live_start_index", idx, "-i", (h.audio ?? h.video).url, "-vn"]
    : h.audio
      ? ["-live_start_index", idx, "-i", h.video.url, "-live_start_index", idx, "-i", h.audio.url, "-map", "0:v", "-map", "1:a"]
      : ["-live_start_index", idx, "-i", h.video.url];
  await ffmpegProgress(["-y", "-hide_banner", "-loglevel", "error", ...inputs, "-t", String(L), "-c", "copy", out],
    { len: L, onPct, timeout: Math.max(600_000, L * 3000) });   // conexiones de casa lentas: hasta 3× lo que dura
  return { back: b, len: L };
}

// ffmpeg con porcentaje real (lee -progress).
function ffmpegProgress(args, { cwd, len, onPct, timeout = 900_000 }) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", ["-progress", "pipe:1", "-nostats", ...args], { cwd });
    let err = "";
    const kill = setTimeout(() => p.kill("SIGKILL"), timeout);
    p.stdout.on("data", (d) => {
      const m = String(d).match(/out_time_us=(\d+)/g);
      if (m) onPct(Math.min(1, Number(m[m.length - 1].split("=")[1]) / 1e6 / Math.max(1, len)));
    });
    p.stderr.on("data", (d) => { err = (err + d).slice(-4000); });
    p.on("error", reject);
    p.on("close", (code) => { clearTimeout(kill); code === 0 ? resolve() : reject(new Error(`ffmpeg: ${err.trim().split("\n").pop()}`)); });
  });
}

// ── Subtítulos automáticos (Whisper dentro de ffmpeg) ──
const WHISPER_MODEL = process.env.WHISPER_MODEL || join(process.cwd(), "models", "ggml-base.bin");
const FONTS_DIR = join(process.cwd(), "worker", "fonts");
const filterPath = (p) => `'${p.replace(/\\/g, "/").replace(/:/g, "\\:")}'`;   // ruta segura dentro de un filtro de ffmpeg

// Transcribe [ss, ss+len) de `input` palabra por palabra → [{ start, end, text }] en ms (vacío si no hay voz).
async function transcribeWords(dir, input, ss, len, lang = "original") {
  if (!existsSync(WHISPER_MODEL)) { console.warn("Sin modelo de Whisper en", WHISPER_MODEL, "→ clip sin subtítulos"); return []; }
  if (!(await ffmpegHasWhisper())) return transcribeWithCli(dir, input, ss, len, lang);
  const file = join(dir, "words.json");
  await rm(file, { force: true });
  await run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...(ss ? ["-ss", String(ss)] : []), "-i", input, "-t", String(len), "-vn",
    "-af", `aresample=16000,whisper=model=${filterPath(WHISPER_MODEL)}:language=auto:queue=10:destination=words.json:format=json:max_len=1${lang === "en" ? ":translate=1" : ""}`,
    "-f", "null", "-"], { cwd: dir, timeout: 1_200_000, maxBuffer: 50_000_000 });
  return existsSync(file) ? parseWhisperWords(await readFile(file, "utf8")) : [];
}

// Algunos ffmpeg para Linux no traen el filtro whisper: entonces se usa el programa whisper-cli (whisper.cpp).
let whisperFilter;
function ffmpegHasWhisper() {
  whisperFilter ??= run("ffmpeg", ["-hide_banner", "-filters"], { maxBuffer: 10_000_000 })
    .then(({ stdout }) => / whisper /.test(stdout)).catch(() => false);
  return whisperFilter;
}

async function transcribeWithCli(dir, input, ss, len, lang) {
  const wav = join(dir, "voz.wav"), base = join(dir, "voz");
  await run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...(ss ? ["-ss", String(ss)] : []), "-i", input, "-t", String(len), "-vn",
    "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav], { timeout: 600_000 });
  try {
    await run(process.env.WHISPER_CLI || "whisper-cli", ["-m", WHISPER_MODEL, "-f", wav, "-l", "auto", "-ml", "1", "-sow", "-oj", "-of", base, "-np", "-bs", "1", "-bo", "1",
      "-t", String(Math.min(8, availableParallelism())), ...(lang === "en" ? ["-tr"] : [])],
      { timeout: 1_200_000, maxBuffer: 50_000_000 });
  } catch (e) {
    console.warn(e.code === "ENOENT" ? "Ni ffmpeg con Whisper ni whisper-cli → clip sin subtítulos" : `whisper-cli falló (código ${e.code}): ${String(e.stderr || e.message).trim().split("\n").slice(-4).join(" | ")}`);
    return [];
  }
  const out = JSON.parse(await readFile(`${base}.json`, "utf8"));
  return (out.transcription ?? []).map((s) => ({ start: s.offsets?.from, end: s.offsets?.to, text: String(s.text ?? "").trim() }))
    .filter((w) => w.text && !/^\[.*\]$/.test(w.text) && Number.isFinite(w.start) && Number.isFinite(w.end));
}

// Filtro de recorte según el encuadre (auto = cámara que sigue y alterna caras; left/center/right fijo),
// tamaño del vídeo resultante y función con las caras en el vídeo final (para los subtítulos).
async function cropFilter(dir, input, { ss, len, aspect, framing, tl }) {
  const { W, H } = await videoSize(input);
  const boxes = (opt) => (tl ? faceBoxesFn(tl, { W, H, ...opt }) : null);
  const size = CROP[aspect ?? "16:9"] ? cropSize(W, H, aspect) : null;
  if (!size) {
    // Sin recorte (16:9) o el vídeo ya es estrecho: recorte simple centrado.
    if (!CROP[aspect ?? "16:9"]) return { filter: null, outW: W, outH: H, faceBoxes: boxes({ cropX: 0 }) };
    const sz = aspect === "1:1" ? Math.min(W, H) : Math.min(W, Math.round(H * 9 / 16));
    const ow = sz - (sz % 2), oh = aspect === "1:1" ? ow : H;
    return { filter: CROP[aspect], outW: ow, outH: oh, faceBoxes: boxes({ cropX: (W - ow) / 2, cw: ow, ch: oh, cropY: (H - oh) / 2 }) };
  }
  const { cw, ch } = size;
  const y = Math.floor((H - ch) / 4) * 2;
  if (framing === "auto" && tl) {
    const keys = planCamera(tl, { W, cw, len });
    if (keys) {
      await writeFile(join(dir, "crop.cmd"), sendcmdFile(keys));
      const xAt = (t) => keys[Math.min(keys.length - 1, Math.max(0, Math.round(t * 30)))].x;
      return { filter: `sendcmd=f=crop.cmd,crop@fr=${cw}:${ch}:${keys[0].x}:${y}`, outW: cw, outH: ch, faceBoxes: boxes({ cropX: xAt, cw, ch, cropY: y }) };
    }
  }
  const x = fixedX(W, cw, framing ?? "center");
  return { filter: `crop=${cw}:${ch}:${x}:${y}`, outW: cw, outH: ch, faceBoxes: boxes({ cropX: x, cw, ch, cropY: y }) };
}

// Turnos para el trabajo pesado (caras + Whisper + codificar): con 1-2 núcleos, hacer varios a la vez solo
// los vuelve todos más lentos. Los clips esperan su turno en orden de llegada (los de cada búsqueda también).
const HEAVY_SLOTS = Math.max(1, Number(process.env.HEAVY_SLOTS ?? (availableParallelism() >= 4 ? 2 : 1)));
let heavyActive = 0;
const heavyQueue = [];
async function heavy(prog, fn) {
  if (heavyActive < HEAVY_SLOTS) heavyActive++;
  else { await prog(50, "Esperando turno"); await new Promise((r) => heavyQueue.push(r)); }   // el hueco pasa directo al siguiente
  try { return await fn(); }
  finally { const next = heavyQueue.shift(); if (next) next(); else heavyActive--; }
}

// Recorta y codifica el vídeo final: proporción + encuadre + (opcional) subtítulos con estilo que no tapan caras.
function encodeVideo(dir, input, opts) {
  return heavy(opts.prog ?? noop, () => encodeVideoNow(dir, input, opts));
}
async function encodeVideoNow(dir, input, { ss = 0, len, aspect, framing, subtitles, subtitleStyle, subOpts = {}, out, prog = noop }) {
  // Las caras se detectan una vez y sirven para la cámara y para colocar los subtítulos.
  let tl = null;
  if ((framing === "auto" && CROP[aspect ?? "16:9"]) || (subtitles && (subOpts.position ?? "auto") === "auto")) {
    if (faceModelAvailable()) {
      await prog(52, "Buscando caras");
      try { tl = await faceTimeline(input, { ss, len }); } catch (e) { console.warn("Detección de caras falló:", e.message); }
    }
  }
  const filters = [];
  const { filter, outW, outH, faceBoxes } = await cropFilter(dir, input, { ss, len, aspect, framing, tl });
  if (filter) filters.push(filter);
  if (subtitles) {
    await prog(58, "Creando subtítulos");
    const words = await transcribeWords(dir, input, ss, len, subOpts.lang);
    if (words.length) {
      await writeFile(join(dir, "subs.ass"), buildAss(words, subtitleStyle ?? DEFAULT_CAPTION, outW, outH, { faceBoxes, size: subOpts.size, position: subOpts.position }));
      // En Linux (Render) las fuentes van en worker/fonts; en Windows se usan las del sistema.
      filters.push(existsSync(FONTS_DIR) ? `subtitles=subs.ass:fontsdir=${filterPath(FONTS_DIR)}` : "subtitles=subs.ass");
    }
  }
  await prog(62, "Editando el vídeo");
  await ffmpegProgress(["-y", "-hide_banner", "-loglevel", "error", ...(ss ? ["-ss", String(ss)] : []), "-i", input, "-t", String(len),
    ...(filters.length ? ["-vf", filters.join(",")] : []), ...CRF, out], { cwd: dir, len, onPct: (k) => prog(62 + 33 * k, "Editando el vídeo") });
  await rm(join(dir, "subs.ass"), { force: true });
}

// Vídeo normal: recorta [start_at_s, start_at_s + duration_s] sin bajar el vídeo entero.
async function captureVod(c, dir, prog = noop) {
  const { stdout } = await run("yt-dlp", ["--no-warnings", "--no-playlist", "--print", "duration", c.source_url], { timeout: 60_000 });
  const total = Number(stdout.trim());
  if (!(total > 0) || c.start_at_s >= total) throw new Error("La posición inicial queda fuera del vídeo");
  const end = Math.min(c.start_at_s + c.duration_s, total);   // si se pasa del final, se recorta
  const len = end - c.start_at_s;
  if (c.format === "image") {
    const { stdout: u } = await run("yt-dlp", ["-g", "-f", `b[height<=${c.quality ?? 720}]/b`, c.source_url], { timeout: 60_000 });
    await run("ffmpeg", ["-y", "-ss", String(c.start_at_s), "-i", u.trim().split("\n")[0], "-frames:v", "1", "-q:v", "2", join(dir, "final.jpg")], { timeout: 60_000 });
    return "jpg";
  }
  const fmt = c.format === "audio" ? ["-f", "ba/b", "-x", "--audio-format", "mp3"]
    : ["-f", `bv*[height<=${c.quality}]+ba/b[height<=${c.quality}]`, "--merge-output-format", "mp4"];
  const stopVod = estimate(prog, 5, 48, Math.max(15, len * 0.8), "Descargando el vídeo");
  try {
    await run("yt-dlp", ["--no-warnings", "--no-playlist", "--no-part", "-o", join(dir, "raw.%(ext)s"), ...fmt,
      "--download-sections", `*${c.start_at_s}-${end}`, "--force-keyframes-at-cuts", c.source_url], { timeout: (len + 300) * 1000, maxBuffer: 50_000_000 });
  } finally { stopVod(); }
  const raw = (await readdir(dir)).find((f) => f.startsWith("raw."));
  if (!raw) throw new Error("No se generó ningún archivo");
  if (c.format === "audio") { await run("ffmpeg", ["-y", "-i", join(dir, raw), "-t", String(len), join(dir, "final.mp3")]); return "mp3"; }
  await encodeVideo(dir, join(dir, raw), { len, aspect: c.aspect, framing: c.framing, subtitles: c.subtitles, subtitleStyle: c.subtitle_style, subOpts: { size: c.subtitle_size, position: c.subtitle_position, lang: c.subtitle_lang }, out: join(dir, "final.mp4"), prog });
  return "mp4";
}

function originalKey(c) {
  const prefix = `originals/${c.user_id}/`;
  return c.platform === "file" && c.source_url.startsWith(prefix)
    && /^[0-9a-f-]{36}\.mp4$/.test(c.source_url.slice(prefix.length)) ? c.source_url : null;
}

async function captureOriginal(c, dir, prog) {
  const key = originalKey(c);
  if (!key) throw new Error("Original inválido");
  await prog(5, "Abriendo el archivo original");
  const { data, error } = await db.storage.from(BUCKET).download(key);
  if (error || !data) throw new Error("No se pudo leer el original");
  const input = join(dir, "original.mp4");
  await writeFile(input, Buffer.from(await data.arrayBuffer()));
  // Abrir únicamente el contenedor local, sin referencias externas de QuickTime.
  const args = ["-y", "-nostdin", "-loglevel", "error", "-protocol_whitelist", "file", "-f", "mov",
    "-enable_drefs", "0", "-ss", String(c.start_at_s ?? 0), "-i", input, "-t", String(c.duration_s)];
  const scale = `scale=w='min(iw,${c.quality * 2})':h='min(ih,${c.quality})':force_original_aspect_ratio=decrease:force_divisible_by=2`;
  const options = { timeout: (120 + c.duration_s * 3) * 1000 };
  if (c.format === "audio") {
    await run("ffmpeg", [...args, "-map", "0:a:0", "-vn", join(dir, "final.mp3")], options);
    return "mp3";
  }
  if (c.format === "image") {
    await run("ffmpeg", [...args, "-map", "0:v:0", "-vf", scale, "-frames:v", "1", join(dir, "final.jpg")], options);
    return "jpg";
  }
  const edit = c.aspect !== "16:9" || c.subtitles;
  const segment = join(dir, edit ? "segment.mp4" : "final.mp4");
  await run("ffmpeg", [...args, "-map", "0:v:0", "-map", "0:a:0?", "-vf", scale, "-pix_fmt", "yuv420p", ...CRF, segment], options);
  const { stdout } = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width", "-of", "csv=p=0", segment]);
  if (!(Number(stdout.trim()) > 0)) throw new Error("El tramo seleccionado no contiene vídeo");
  if (!edit) return "mp4";
  await encodeVideo(dir, segment, { len: c.duration_s, aspect: c.aspect, framing: c.framing, subtitles: c.subtitles,
    subtitleStyle: c.subtitle_style, subOpts: { size: c.subtitle_size, position: c.subtitle_position, lang: c.subtitle_lang },
    out: join(dir, "final.mp4"), prog });
  return "mp4";
}

async function capture(c, dir, prog = noop) {
  if (c.platform === "file") return captureOriginal(c, dir, prog);
  if (c.source_kind === "vod") return captureVod(c, dir, prog);
  const out = join(dir, "raw.%(ext)s");
  const base = ["--no-warnings", "--no-playlist", "-o", out, "--no-part"];
  if (c.format === "image") {
    // Un solo fotograma del directo, sin descargar vídeo.
    const { stdout } = await run("yt-dlp", ["-g", "-f", `b[height<=${c.quality ?? 720}]/b`, c.source_url], { timeout: 60_000 });
    await run("ffmpeg", ["-y", "-i", stdout.trim().split("\n")[0], "-frames:v", "1", "-q:v", "2", join(dir, "final.jpg")], { timeout: 60_000 });
    return "jpg";
  }
  const fmt = c.format === "audio"
    ? ["-f", "ba/b", "-x", "--audio-format", "mp3"]
    : ["-f", `bv*[height<=${c.quality}]+ba/b[height<=${c.quality}]`, "--merge-output-format", "mp4"];
  if (c.platform === "youtube" && c.start_offset_s > 0) {
    // YouTube: retroceder con la lista HLS (rápido: 10 min del pasado se bajan en ~30 s).
    const { stdout: js } = await run("yt-dlp", ["-J", "--no-warnings", "--no-playlist", "--skip-download", c.source_url], { timeout: 60_000, maxBuffer: 50_000_000 });
    const audioOnly = c.format === "audio";
    await prog(5, "Descargando del directo");
    await grabYoutubePast(JSON.parse(js), { back: c.start_offset_s, len: c.duration_s, audioOnly, maxHeight: c.quality ?? 480,
      out: join(dir, audioOnly ? "raw.m4a" : "raw.mp4"), onPct: (k) => prog(5 + 43 * k, "Descargando del directo") });
  } else {
  // start_offset_s = 0 → grabar en vivo desde ahora durante duration_s.
  // start_offset_s > 0 → retroceder usando el DVR del directo (--live-from-start; Twitch, Kick…).
  const range = c.start_offset_s > 0
    ? ["--live-from-start", "--download-sections", `*-${c.start_offset_s}-${c.start_offset_s - c.duration_s > 0 ? `-${c.start_offset_s - c.duration_s}` : "inf"}`]
    : ["--downloader", "ffmpeg", "--downloader-args", `ffmpeg:-t ${c.duration_s}`];
  // Grabar en vivo tarda lo que dura el clip: avance lineal. Retroceder (DVR) se descarga más rápido.
  const stopLive = c.start_offset_s > 0
    ? estimate(prog, 5, 48, Math.max(15, c.duration_s * 0.8), "Descargando del directo")
    : estimate(prog, 5, 48, c.duration_s + 5, "Grabando el directo", true);
  try {
    await run("yt-dlp", [...base, ...fmt, ...range, c.source_url], { timeout: (c.duration_s + 240) * 1000, maxBuffer: 50_000_000 });
  } finally { stopLive(); }
  }
  const raw = (await readdir(dir)).find((f) => f.startsWith("raw."));
  if (!raw) throw new Error("No se generó ningún archivo");
  if (c.format === "audio") { await run("ffmpeg", ["-y", "-i", join(dir, raw), "-t", String(c.duration_s), join(dir, "final.mp3")]); return "mp3"; }
  await encodeVideo(dir, join(dir, raw), { len: c.duration_s, aspect: c.aspect, framing: c.framing, subtitles: c.subtitles, subtitleStyle: c.subtitle_style, subOpts: { size: c.subtitle_size, position: c.subtitle_position, lang: c.subtitle_lang }, out: join(dir, "final.mp4"), prog });
  return "mp4";
}

async function upload(c, file, ext, prog = noop) {
  const size = (await stat(file)).size;
  if (!size) throw new Error("Archivo vacío");
  await prog(97, "Subiendo");
  const key = `clips/${c.user_id}/${c.id}.${ext}`;
  const { error } = await db.storage.from(BUCKET).upload(key, await readFile(file), { contentType: MIME[ext], upsert: true });
  if (error) throw new Error(`Subida a Supabase Storage: ${error.message}`);
  await db.from("clips").update({ status: "ready", storage_key: key, size_bytes: size, expires_at: new Date(Date.now() + 30 * 864e5).toISOString(), progress: 100, stage: null }).eq("id", c.id);
}

// Crea un clip cobrando créditos / prueba. Devuelve el id o null si ya no quedan.
async function chargeClip(a, extra) {
  const { data: id, error } = await db.rpc("create_clip", { p_user: a.user_id, p_platform: a.platform, p_url: a.source_url,
    p_format: a.format, p_aspect: a.aspect, p_quality: a.quality, p_start: 0, p_duration: a.duration_s, p_cost: a.cost,
    p_trial: a.is_trial, p_kind: a.source_kind, p_start_at: extra.startAt ?? null });
  if (error) { console.warn("auto", a.id, "sin créditos/pruebas:", error.message); return null; }
  await db.from("clips").update({ auto_job_id: a.id, title: extra.title ?? null, subtitles: !!a.subtitles, subtitle_style: a.subtitle_style ?? "clasico", subtitle_size: a.subtitle_size ?? "m", subtitle_position: a.subtitle_position ?? "auto", subtitle_lang: a.subtitle_lang ?? "original", framing: a.framing ?? "auto", ...(extra.status ? { status: extra.status } : {}), ...(extra.stage ? { stage: extra.stage, progress: 0 } : {}) }).eq("id", id);
  return id;
}

// Clips automáticos: analiza el audio, elige momentos destacados al azar y crea los clips.
async function autoJob(a) {
  const autoId = a.id;
  const dir = await mkdtemp(join(tmpdir(), "auto-"));
  let created = 0;
  try {
    const { stdout: js } = await run("yt-dlp", ["-J", "--no-warnings", "--no-playlist", "--skip-download", a.source_url], { timeout: 60_000, maxBuffer: 50_000_000 });
    const info = JSON.parse(js);
    if (a.source_kind === "vod") {
      // Solo hace falta el sonido para analizar: se baja el audio o, si la plataforma no lo da aparte
      // (Twitch, Kick), la calidad MÁS BAJA (160p), con 16 trozos a la vez. Un vídeo de 12 h de Kick pasó
      // de ~8 h de descarga (1080p, de uno en uno) a ~35 min. Luego cada clip se recorta con su calidad.
      const aprog = autoProgressFor(autoId);
      await aprog(1, "Descargando el audio del vídeo");
      await ytdlpProgress(["--no-warnings", "--no-playlist", "--no-part", "-N", "16",
        "-f", "wa[protocol=https]/ba[protocol=https]/worstaudio/worst", "-o", join(dir, "audio.%(ext)s"), a.source_url],
        { timeout: Math.max(1_800_000, (info.duration ?? 0) * 400), onPct: (k) => aprog(1 + 79 * k, "Descargando el audio del vídeo") });
      await aprog(82, "Buscando los mejores momentos");
      const audio = (await readdir(dir)).find((f) => f.startsWith("audio."));
      if (!audio) throw new Error("No se pudo descargar el audio");
      const rms = await loudnessPerSecond(join(dir, audio));
      const heat = info.heatmap?.length ? heatPerSecond(info.heatmap, rms.length) : null;
      const starts = pickMoments(rms, a.duration_s, a.count, { heat });
      await aprog(95, "Creando los clips");
      console.log("auto", autoId, "momentos:", starts.join(", "), heat ? "(con heatmap)" : "(solo audio)");
      for (const s of starts) {
        const id = await chargeClip(a, { startAt: s, title: info.title });
        if (!id) break;
        created++;
      }
    } else {
      if (a.platform === "youtube") {
        // YouTube guarda la última hora del directo: se analiza lo YA emitido, sin esperar a grabar.
        const aprog = autoProgressFor(autoId);
        await aprog(2, "Descargando lo último del directo");
        const audioOnly = a.format === "audio";
        const got = await grabYoutubePast(info, { back: a.window_s, untilNow: true, audioOnly, maxHeight: a.quality ?? 480,
          out: join(dir, audioOnly ? "raw.m4a" : "raw.mp4"), onPct: (k) => aprog(2 + 68 * k, "Descargando lo último del directo") });
        console.log("auto", autoId, "YouTube: analizando los últimos", Math.round(got.len / 60), "min del directo");
        await aprog(72, "Buscando los mejores momentos");
      } else {
      // Directo (TikTok, Twitch, Kick): graba una ventana desde ahora, busca los mejores momentos y los recorta.
      const fmt = a.format === "audio" ? ["-f", "ba/b", "-x", "--audio-format", "mp3"]
        : ["-f", `bv*[height<=${a.quality}]+ba/b[height<=${a.quality}]`, "--merge-output-format", "mp4"];
      // La web usa recording_started_at para mostrar "Grabando · 12 de 30 min".
      await db.from("auto_jobs").update({ recording_started_at: new Date().toISOString() }).eq("id", autoId);
      // Si el directo termina antes de tiempo, yt-dlp acaba solo y se usa lo grabado hasta ese momento.
      await run("yt-dlp", ["--no-warnings", "--no-playlist", "--no-part", "-o", join(dir, "raw.%(ext)s"), ...fmt,
        "--downloader", "ffmpeg", "--downloader-args", `ffmpeg:-t ${a.window_s}`, a.source_url], { timeout: (a.window_s + 300) * 1000, maxBuffer: 200_000_000 });
      await db.from("auto_jobs").update({ recording_started_at: null }).eq("id", autoId);   // fin de la grabación: ahora analiza
      }
      const raw = (await readdir(dir)).find((f) => f.startsWith("raw."));
      if (!raw) throw new Error("No se pudo grabar el directo");
      const rms = await loudnessPerSecond(join(dir, raw));
      const starts = pickMoments(rms, a.duration_s, a.count);
      console.log("auto", autoId, "momentos del directo:", starts.join(", "));
      // Se crean todos los clips desde el principio: el usuario ve cuántos vienen y el avance de cada uno.
      const pending = [];
      for (const s of starts) {
        const id = await chargeClip(a, { title: info.title, status: "processing", stage: "En espera" });
        if (!id) break;
        pending.push({ id, s });
      }
      created = pending.length;
      const aprog = autoProgressFor(autoId);
      for (const [i, { id, s }] of pending.entries()) {
        await aprog(75 + (24 * i) / pending.length, `Creando los clips · ${i + 1} de ${pending.length}`);
        const c = { id, user_id: a.user_id }, prog = progressFor(id), t0 = Date.now();
        try {
          const ext = a.format === "audio" ? "mp3" : "mp4", out = join(dir, `final-${s}.${ext}`);
          if (a.format === "audio") await run("ffmpeg", ["-y", "-ss", String(s), "-i", join(dir, raw), "-t", String(a.duration_s), out], { timeout: 600_000 });
          else await encodeVideo(dir, join(dir, raw), { ss: s, len: a.duration_s, aspect: a.aspect, framing: a.framing, subtitles: a.subtitles, subtitleStyle: a.subtitle_style, subOpts: { size: a.subtitle_size, position: a.subtitle_position, lang: a.subtitle_lang }, out, prog });
          await upload(c, out, ext, prog);
          await rm(out, { force: true });
          console.log("auto", autoId, `clip ${i + 1}/${pending.length} listo en ${Math.round((Date.now() - t0) / 1000)} s`);
        } catch (e) {
          console.error("auto clip", id, "falló:", e.message);
          await db.rpc("refund_clip", { p_clip: id, p_error: "No se pudo recortar el momento" });
        }
      }
    }
    await db.from("auto_jobs").update({ status: created ? "done" : "error", clips_created: created,
      error: created ? null : "No te quedan créditos o pruebas para crear clips" }).eq("id", autoId);
  } catch (e) {
    console.error("auto", autoId, "falló:", e.message);
    const message = a.platform === "youtube" && youtubeBlocked(e) ? YOUTUBE_ERROR
      : a.source_kind === "vod" ? "No se pudo analizar el vídeo" : "No se pudo grabar el directo";
    await db.from("auto_jobs").update({ status: "error", clips_created: created, error: message }).eq("id", autoId);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Un clip ya reservado (status = processing) por claim_clip().
async function clipJob(c) {
  const clipId = c.id;
  const dir = await mkdtemp(join(tmpdir(), "clip-"));
  try {
    const prog = progressFor(clipId);
    const ext = await capture(c, dir, prog);
    await upload(c, join(dir, `final.${ext}`), ext, prog);
  } catch (e) {
    console.error("clip", clipId, "falló:", e.message);
    // Devuelve créditos (o la prueba) de forma atómica y marca el error.
    const message = c.platform === "file" ? "No se pudo recortar el archivo. Comprueba el formato y el minuto de inicio."
      : c.platform === "youtube" && youtubeBlocked(e) ? YOUTUBE_ERROR
      : c.source_kind === "vod" ? "No se pudo crear el clip" : "No se pudo capturar el directo";
    await db.rpc("refund_clip", { p_clip: clipId, p_error: message });
  } finally {
    await rm(dir, { recursive: true, force: true });
    const key = originalKey(c);
    if (key) {
      const { error } = await db.storage.from(BUCKET).remove([key]);
      if (error) console.error("Limpieza del original", clipId, error.message);
    }
  }
}

// ── Cola en la base de datos (sin Redis ni Docker) ──
// Cada 2 s mira si hay trabajos pendientes y se queda con ellos mientras tenga huecos libres.
// claim_clip / claim_auto_job reservan el trabajo de forma atómica (dos workers nunca cogen el mismo).
// Clips y búsquedas tienen huecos separados: una grabación de 1 h (que casi no gasta CPU) ya no deja
// a todos los demás usuarios esperando. Lo pesado (editar con caras y subtítulos) se reparte por turnos con heavy().
const CONCURRENCY = Math.max(1, Number(process.env.WORKER_CONCURRENCY ?? 2));
const AUTO_CONCURRENCY = Math.max(1, Number(process.env.AUTO_CONCURRENCY ?? 2));
const active = { clip: 0, auto: 0 };
let polling = false;

async function claim() {
  // Primero los clips (son cortos) y después las búsquedas/grabaciones (pueden durar horas).
  if (active.clip < CONCURRENCY) {
    const { data: clips, error: e1 } = PLATFORMS
      ? await db.rpc("claim_clip_for_platforms", { p_platforms: PLATFORMS }) : await db.rpc("claim_clip");
    if (e1) throw new Error(e1.message);
    if (clips?.length) return { kind: "clip", job: clips[0] };
  }
  if (active.auto < AUTO_CONCURRENCY) {
    const { data: autos, error: e2 } = PLATFORMS
      ? await db.rpc("claim_auto_job_for_platforms", { p_platforms: PLATFORMS }) : await db.rpc("claim_auto_job");
    if (e2) throw new Error(e2.message);
    if (autos?.length) return { kind: "auto", job: autos[0] };
  }
  return null;
}

async function poll() {
  if (polling) return;
  polling = true;
  try {
    while (active.clip < CONCURRENCY || active.auto < AUTO_CONCURRENCY) {
      const next = await claim();
      if (!next) break;
      active[next.kind]++;
      console.log(next.kind === "clip" ? "clip" : "búsqueda", next.job.id, "empieza",
        `(clips ${active.clip}/${CONCURRENCY} · búsquedas ${active.auto}/${AUTO_CONCURRENCY})`);
      (next.kind === "clip" ? clipJob(next.job) : autoJob(next.job))
        .catch((e) => console.error(next.kind, next.job.id, "error inesperado:", e.message))
        .finally(() => { active[next.kind]--; poll(); });
    }
  } catch (e) {
    console.error("No se pudo consultar la cola en Supabase:", e.message);
  } finally {
    polling = false;
  }
}

// Al arrancar: lo que se quedó a medias porque el worker se apagó no se puede retomar → se cancela
// (devolviendo créditos o la prueba) para que no quede "procesando" para siempre.
async function recoverInterrupted() {
  const interrupted = db.from("clips").select("id,user_id,platform,source_url").eq("status", "processing");
  const { data: stuck } = await (PLATFORMS ? interrupted.in("platform", PLATFORMS) : interrupted);
  for (const c of stuck ?? []) {
    await db.rpc("refund_clip", { p_clip: c.id, p_error: "Se interrumpió porque el servidor se reinició" });
    const key = originalKey(c);
    if (key) await db.storage.from(BUCKET).remove([key]);
  }
  const autoInterrupted = db.from("auto_jobs").update({ status: "error", error: "Se interrumpió porque el servidor se reinició. Inténtalo de nuevo." })
    .eq("status", "analyzing");
  if (PLATFORMS) autoInterrupted.in("platform", PLATFORMS);
  const { data: autos } = await autoInterrupted.select("id");
  const n = (stuck?.length ?? 0) + (autos?.length ?? 0);
  if (n) console.log("Cancelados", n, "trabajos que quedaron a medias (créditos devueltos)");
}

// Las comprobaciones de enlaces tienen su propio turno para responder incluso si hay un clip largo.
let checkingYoutube = false;
async function pollYoutubeProbes() {
  if (checkingYoutube) return;
  checkingYoutube = true;
  try {
    const { data, error } = await db.rpc("claim_youtube_probe");
    if (error) throw error;
    const job = data?.[0];
    if (!job) return;
    const result = await probeMedia("youtube", job.source_url);
    const { error: saveError } = await db.from("youtube_probes").update({ result }).eq("id", job.id);
    if (saveError) throw saveError;
  } catch (error) {
    console.error("Cola de consultas de YouTube:", error.message);
  } finally {
    checkingYoutube = false;
  }
}

if (YOUTUBE_MODE === "youtube-only") {
  const tools = await Promise.all([
    run("yt-dlp", ["--version"]), run("deno", ["--version"]), run("ffmpeg", ["-version"]),
  ]);
  console.log("Worker de YouTube:", tools.map(({ stdout }) => stdout.trim().split("\n")[0]).join(" · "));
  const old = new Date(Date.now() - 60_000).toISOString();
  const { error } = await db.from("youtube_probes").delete().lt("created_at", old);
  if (error) throw new Error(`No se pudo abrir la cola de YouTube: ${error.message}`);
  setInterval(pollYoutubeProbes, 1_500);
  pollYoutubeProbes();
}
await recoverInterrupted();
setInterval(poll, 2000);
poll();
const scopeLabel = PLATFORMS ? `${PLATFORMS.join(", ")} · ` : "";
console.log(`Worker de ClipLive listo · ${scopeLabel}cola en Supabase · ${CONCURRENCY} trabajos a la vez`);
