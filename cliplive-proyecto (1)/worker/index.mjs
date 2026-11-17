// Worker de captura: toma trabajos de Redis, graba el directo con yt-dlp + ffmpeg y sube el archivo a R2/S3.
// Requiere en el PATH: yt-dlp, ffmpeg y un runtime de JS (Deno) para YouTube. Ver README.
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const run = promisify(execFile);
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const s3 = new S3Client({ region: process.env.S3_REGION ?? "auto", endpoint: process.env.S3_ENDPOINT,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } });
const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const CRF = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-movflags", "+faststart"];
const CROP = { "9:16": "crop=ih*9/16:ih", "1:1": "crop=min(iw\\,ih):min(iw\\,ih)", "16:9": null };
const MIME = { mp4: "video/mp4", mp3: "audio/mpeg", jpg: "image/jpeg" };

// Vídeo normal: recorta [start_at_s, start_at_s + duration_s] sin bajar el vídeo entero.
async function captureVod(c, dir) {
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
  await run("yt-dlp", ["--no-warnings", "--no-playlist", "--no-part", "-o", join(dir, "raw.%(ext)s"), ...fmt,
    "--download-sections", `*${c.start_at_s}-${end}`, "--force-keyframes-at-cuts", c.source_url], { timeout: (len + 300) * 1000, maxBuffer: 50_000_000 });
  const raw = (await readdir(dir)).find((f) => f.startsWith("raw."));
  if (!raw) throw new Error("No se generó ningún archivo");
  if (c.format === "audio") { await run("ffmpeg", ["-y", "-i", join(dir, raw), "-t", String(len), join(dir, "final.mp3")]); return "mp3"; }
  const vf = CROP[c.aspect ?? "16:9"];
  await run("ffmpeg", ["-y", "-i", join(dir, raw), "-t", String(len), ...(vf ? ["-vf", vf] : []), ...CRF, join(dir, "final.mp4")], { timeout: 600_000 });
  return "mp4";
}

async function capture(c, dir) {
  if (c.source_kind === "vod") return captureVod(c, dir);
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
  await run("yt-dlp", [...base, ...fmt, ...range, c.source_url], { timeout: (c.duration_s + 240) * 1000, maxBuffer: 50_000_000 });
  const raw = (await readdir(dir)).find((f) => f.startsWith("raw."));
  if (!raw) throw new Error("No se generó ningún archivo");
  if (c.format === "audio") { await run("ffmpeg", ["-y", "-i", join(dir, raw), "-t", String(c.duration_s), join(dir, "final.mp3")]); return "mp3"; }
  const vf = CROP[c.aspect ?? "16:9"];
  await run("ffmpeg", ["-y", "-i", join(dir, raw), "-t", String(c.duration_s), ...(vf ? ["-vf", vf] : []), ...CRF, join(dir, "final.mp4")], { timeout: 600_000 });
  return "mp4";
}

new Worker("clips", async (job) => {
  const { clipId } = job.data;
  const { data: c } = await db.from("clips").select("*").eq("id", clipId).single();
  if (!c || c.status !== "queued") return;
  await db.from("clips").update({ status: "processing" }).eq("id", clipId);
  const dir = await mkdtemp(join(tmpdir(), "clip-"));
  try {
    const ext = await capture(c, dir);
    const file = join(dir, `final.${ext}`), size = (await stat(file)).size;
    if (!size) throw new Error("Archivo vacío");
    const key = `clips/${c.user_id}/${clipId}.${ext}`;
    await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: await readFile(file), ContentType: MIME[ext] }));
    await db.from("clips").update({ status: "ready", storage_key: key, size_bytes: size, expires_at: new Date(Date.now() + 30 * 864e5).toISOString() }).eq("id", clipId);
  } catch (e) {
    console.error("clip", clipId, "falló:", e.message);
    // Devuelve créditos (o la prueba) de forma atómica y marca el error.
    await db.rpc("refund_clip", { p_clip: clipId, p_error: "No se pudo capturar el directo" });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, { connection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2) });
console.log("Worker de ClipLive listo");
