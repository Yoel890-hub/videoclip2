// Crea la portada (JPG) de los clips de vídeo que ya existían antes de que el worker las generara.
//   node --env-file=.env.local scripts/backfill-thumbs.mjs          → todos los que faltan
//   node --env-file=.env.local scripts/backfill-thumbs.mjs 1        → solo 1 (para probar)
// Necesita ffmpeg en el PATH. Solo lee los clips y sube las portadas; no cambia nada más.
import { createClient } from "@supabase/supabase-js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const run = promisify(execFile);
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BUCKET = process.env.STORAGE_BUCKET || "clips";
const limit = Number(process.argv[2]) || Infinity;

const { data: clips, error } = await db.from("clips").select("id,user_id,storage_key")
  .eq("status", "ready").like("storage_key", "%.mp4").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false });
if (error) throw error;

const dir = await mkdtemp(join(tmpdir(), "thumbs-"));
let done = 0, skipped = 0, failed = 0;
const existing = new Map();   // carpeta → nombres de archivo
for (const c of clips) {
  if (done >= limit) break;
  const folder = c.storage_key.slice(0, c.storage_key.lastIndexOf("/")), thumb = c.storage_key.replace(/\.mp4$/, ".thumb.jpg");
  if (!existing.has(folder)) {
    const { data } = await db.storage.from(BUCKET).list(folder, { limit: 1000 });
    existing.set(folder, new Set((data ?? []).map((f) => f.name)));
  }
  if (existing.get(folder).has(thumb.slice(folder.length + 1))) { skipped++; continue; }
  try {
    const { data: signed, error: e1 } = await db.storage.from(BUCKET).createSignedUrl(c.storage_key, 600);
    if (e1) throw e1;
    const out = join(dir, `${c.id}.jpg`);
    await run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-ss", "1.5", "-i", signed.signedUrl, "-frames:v", "1",
      "-vf", "scale='min(720,iw)':-2", "-q:v", "4", out], { timeout: 120_000 });
    const { error: e2 } = await db.storage.from(BUCKET).upload(thumb, await readFile(out), { contentType: "image/jpeg", upsert: true });
    if (e2) throw e2;
    done++;
    console.log(`✓ ${done} portada creada (${c.id.slice(0, 8)})`);
  } catch (e) {
    failed++;
    console.warn(`✗ ${c.id.slice(0, 8)}: ${e.message}`);
  }
}
await rm(dir, { recursive: true, force: true });
console.log(`Listo: ${done} creadas · ${skipped} ya tenían · ${failed} fallaron · ${clips.length} clips de vídeo disponibles`);
