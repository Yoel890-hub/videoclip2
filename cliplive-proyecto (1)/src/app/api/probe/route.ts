import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { detectPlatform, isShortLink, resolveShortLink } from "@/lib/platforms";
import { probeMedia } from "@/lib/media-probe.mjs";
import { admin, requireUser } from "@/lib/supabase";

const bin = join(process.cwd(), "bin");
if (existsSync(bin) && !process.env.PATH?.split(delimiter).includes(bin)) {
  process.env.PATH = [bin, process.env.PATH].filter(Boolean).join(delimiter);
}

const WORKER_UNAVAILABLE = "No pudimos conectar con el servicio de clips de YouTube. Inténtalo en unos minutos.";

async function probeOnWorker(userId: string, url: string, signal: AbortSignal) {
  const db = admin();
  const start = Date.now();
  const old = new Date(start - 60_000).toISOString();
  const { error: cleanupError } = await db.from("youtube_probes").delete().eq("user_id", userId).lt("created_at", old);
  if (cleanupError) {
    console.error("Cola de consultas de YouTube", cleanupError.message);
    return NextResponse.json({ error: WORKER_UNAVAILABLE }, { status: 503 });
  }
  const { data: job, error } = await db.from("youtube_probes").insert({ user_id: userId, source_url: url }).select("id").single();
  if (error || !job) {
    if (error?.code === "23505") return NextResponse.json({ error: "Ya tienes un enlace de YouTube en revisión." }, { status: 429 });
    console.error("Cola de consultas de YouTube", error?.message);
    return NextResponse.json({ error: WORKER_UNAVAILABLE }, { status: 503 });
  }
  try {
    while (Date.now() - start < 45_000 && !signal.aborted) {
      await delay(1_000, undefined, { signal });
      const { data, error: readError } = await db.from("youtube_probes").select("result").eq("id", job.id).maybeSingle();
      if (readError || !data) throw new Error(readError?.message ?? "Consulta de YouTube no encontrada");
      if (data.result) return NextResponse.json(data.result.body, { status: data.result.status });
    }
  } catch (pollError) {
    if (!signal.aborted) console.error("Resultado de la consulta de YouTube", pollError);
  } finally {
    const { error: deleteError } = await db.from("youtube_probes").delete().eq("id", job.id);
    if (deleteError) console.error("Limpieza de consulta de YouTube", deleteError.message);
  }
  return NextResponse.json({ error: WORKER_UNAVAILABLE }, { status: 503 });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const input = await req.json().catch(() => null);
  let target = typeof input?.url === "string" ? detectPlatform(input.url) : null;
  if (!target) return NextResponse.json({ error: "URL no válida. Usa YouTube, Twitch, Kick o TikTok." }, { status: 400 });

  if (isShortLink(target.url)) {
    try { target = detectPlatform(await resolveShortLink(target.url)) ?? target; } catch { /* Intentar con el enlace corto. */ }
  }
  if (target.platform === "tiktok") {
    const profile = new URL(target.url);
    if (/^\/@[^/]+\/?$/.test(profile.pathname)) {
      profile.pathname = profile.pathname.replace(/\/?$/, "/live");
      target = { ...target, url: profile.toString() };
    }
  }
  if (target.platform === "youtube" && process.env.YOUTUBE_WORKER_MODE === "external") {
    return probeOnWorker(user.id, target.url, req.signal);
  }
  const result = await probeMedia(target.platform, target.url);
  return NextResponse.json(result.body, { status: result.status });
}
