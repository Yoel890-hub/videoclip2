// Worker de captura: toma trabajos de Redis, graba el directo con yt-dlp + ffmpeg y sube el archivo a Supabase Storage.
// Requiere en el PATH: yt-dlp, ffmpeg y un runtime de JS (Deno) para YouTube. Ver README.
import { Worker, Queue } from "bullmq";
import { loudnessPerSecond, heatPerSecond, pickMoments } from "./highlights.mjs";
import { videoSize, cropSize, fixedX, faceTimeline, planCamera, faceBoxesFn, sendcmdFile, faceModelAvailable } from "./framing.mjs";
import { buildAss, parseWhisperWords, DEFAULT_CAPTION } from "./captions.mjs";
import IORedis from "ioredis";
import { createClient } from "@supabase/supabase-js";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";

const run = promisify(execFile);
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BUCKET = process.env.STORAGE_BUCKET || "clips";
const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue("clips", { connection });
const CRF = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-movflags", "+faststart"];
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
const filterPath = (p) => `'${p.replace(/\\/g, "/").replace(/:/g, "\\:")}'`;   // ruta segura dentro de un filtro de ffmpeg

// Transcribe [ss, ss+len) de `input` palabra por palabra → [{ start, end, text }] en ms (vacío si no hay voz).
async function transcribeWords(dir, input, ss, len, lang = "original") {
  if (!existsSync(WHISPER_MODEL)) { console.warn("Sin modelo de Whisper en", WHISPER_MODEL, "→ clip sin subtítulos"); return []; }
  const file = join(dir, "words.json");
  await rm(file, { force: true });
  await run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...(ss ? ["-ss", String(ss)] : []), "-i", input, "-t", String(len), "-vn",
    "-af", `aresample=16000,whisper=model=${filterPath(WHISPER_MODEL)}:language=auto:queue=10:destination=words.json:format=json:max_len=1${lang === "en" ? ":translate=1" : ""}`,
    "-f", "null", "-"], { cwd: dir, timeout: 1_200_000, maxBuffer: 50_000_000 });
  return existsSync(file) ? parseWhisperWords(await readFile(file, "utf8")) : [];
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

// Recorta y codifica el vídeo final: proporción + encuadre + (opcional) subtítulos con estilo que no tapan caras.
async function encodeVideo(dir, input, { ss = 0, len, aspect, framing, subtitles, subtitleStyle, subOpts = {}, out, prog = noop }) {
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
      filters.push("subtitles=subs.ass");
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

async function capture(c, dir, prog = noop) {
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
  // start_offset_s = 0 → grabar en vivo desde ahora durante duration_s.
  // start_offset_s > 0 → retroceder usando el DVR del directo (--live-from-start; solo plataformas que lo permiten).
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
  await db.from("clips").update({ auto_job_id: a.id, title: extra.title ?? null, subtitles: !!a.subtitles, subtitle_style: a.subtitle_style ?? "clasico", subtitle_size: a.subtitle_size ?? "m", subtitle_position: a.subtitle_position ?? "auto", subtitle_lang: a.subtitle_lang ?? "original", framing: a.framing ?? "auto", ...(extra.status ? { status: extra.status } : {}) }).eq("id", id);
  return id;
}

// Clips automáticos: analiza el audio, elige momentos destacados al azar y crea los clips.
async function autoJob(autoId) {
  const { data: a } = await db.from("auto_jobs").select("*").eq("id", autoId).single();
  if (!a || a.status !== "queued") return;
  await db.from("auto_jobs").update({ status: "analyzing" }).eq("id", autoId);
  const dir = await mkdtemp(join(tmpdir(), "auto-"));
  let created = 0;
  try {
    const { stdout: js } = await run("yt-dlp", ["-J", "--no-warnings", "--no-playlist", "--skip-download", a.source_url], { timeout: 60_000, maxBuffer: 50_000_000 });
    const info = JSON.parse(js);
    if (a.source_kind === "vod") {
      // Solo el audio (pesa poco) para analizar; luego cada clip se recorta con el flujo normal.
      await run("yt-dlp", ["--no-warnings", "--no-playlist", "--no-part", "-f", "wa[protocol=https]/ba[protocol=https]/wa/ba/b", "-o", join(dir, "audio.%(ext)s"), a.source_url], { timeout: 1_800_000, maxBuffer: 50_000_000 });
      const audio = (await readdir(dir)).find((f) => f.startsWith("audio."));
      if (!audio) throw new Error("No se pudo descargar el audio");
      const rms = await loudnessPerSecond(join(dir, audio));
      const heat = info.heatmap?.length ? heatPerSecond(info.heatmap, rms.length) : null;
      const starts = pickMoments(rms, a.duration_s, a.count, { heat });
      console.log("auto", autoId, "momentos:", starts.join(", "), heat ? "(con heatmap)" : "(solo audio)");
      for (const s of starts) {
        const id = await chargeClip(a, { startAt: s, title: info.title });
        if (!id) break;
        await queue.add("capture", { clipId: id }, { attempts: 1, removeOnComplete: 1000, removeOnFail: 1000 });
        created++;
      }
    } else {
      // Directo: graba una ventana, busca los mejores momentos dentro y los recorta de esa grabación.
      const fmt = a.format === "audio" ? ["-f", "ba/b", "-x", "--audio-format", "mp3"]
        : ["-f", `bv*[height<=${a.quality}]+ba/b[height<=${a.quality}]`, "--merge-output-format", "mp4"];
      await run("yt-dlp", ["--no-warnings", "--no-playlist", "--no-part", "-o", join(dir, "raw.%(ext)s"), ...fmt,
        "--downloader", "ffmpeg", "--downloader-args", `ffmpeg:-t ${a.window_s}`, a.source_url], { timeout: (a.window_s + 300) * 1000, maxBuffer: 50_000_000 });
      const raw = (await readdir(dir)).find((f) => f.startsWith("raw."));
      if (!raw) throw new Error("No se pudo grabar el directo");
      const rms = await loudnessPerSecond(join(dir, raw));
      const starts = pickMoments(rms, a.duration_s, a.count);
      console.log("auto", autoId, "momentos del directo:", starts.join(", "));
      for (const s of starts) {
        const id = await chargeClip(a, { title: info.title, status: "processing" });
        if (!id) break;
        created++;
        const c = { id, user_id: a.user_id }, prog = progressFor(id);
        try {
          const ext = a.format === "audio" ? "mp3" : "mp4", out = join(dir, `final-${s}.${ext}`);
          if (a.format === "audio") await run("ffmpeg", ["-y", "-ss", String(s), "-i", join(dir, raw), "-t", String(a.duration_s), out], { timeout: 600_000 });
          else await encodeVideo(dir, join(dir, raw), { ss: s, len: a.duration_s, aspect: a.aspect, framing: a.framing, subtitles: a.subtitles, subtitleStyle: a.subtitle_style, subOpts: { size: a.subtitle_size, position: a.subtitle_position, lang: a.subtitle_lang }, out, prog });
          await upload(c, out, ext, prog);
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
    await db.from("auto_jobs").update({ status: "error", clips_created: created, error: a.source_kind === "vod" ? "No se pudo analizar el vídeo" : "No se pudo grabar el directo" }).eq("id", autoId);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

new Worker("clips", async (job) => {
  if (job.name === "auto") return autoJob(job.data.autoId);
  const { clipId } = job.data;
  const { data: c } = await db.from("clips").select("*").eq("id", clipId).single();
  if (!c || c.status !== "queued") return;
  await db.from("clips").update({ status: "processing" }).eq("id", clipId);
  const dir = await mkdtemp(join(tmpdir(), "clip-"));
  try {
    const prog = progressFor(clipId);
    const ext = await capture(c, dir, prog);
    await upload(c, join(dir, `final.${ext}`), ext, prog);
  } catch (e) {
    console.error("clip", clipId, "falló:", e.message);
    // Devuelve créditos (o la prueba) de forma atómica y marca el error.
    await db.rpc("refund_clip", { p_clip: clipId, p_error: c.source_kind === "vod" ? "No se pudo crear el clip" : "No se pudo capturar el directo" });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, { connection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2) });
console.log("Worker de ClipLive listo");
