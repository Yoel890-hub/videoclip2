import { NextResponse } from "next/server";
import { detectPlatform, VOD_PLATFORMS } from "@/lib/platforms";
import { clipCost, QUALITIES, TRIALS, AUTO_WINDOWS, FRAMINGS, RECORD_WINDOWS, recordWindowsFor, type PlanId } from "@/lib/plans";
import { isAdmin, effectivePlan } from "@/lib/admin";
import { CAPTION_IDS, DEFAULT_CAPTION, SUB_SIZES, SUB_POSITIONS, SUB_LANGS, subOpt, captionAllowed, CAPTION_TIER, TIER_NAME } from "@/lib/captionStyles";
import { admin, requireUser } from "@/lib/supabase";
import { clipQueue } from "@/lib/queue";

// Clips automáticos de los momentos destacados.
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const b = await req.json();
  const target = detectPlatform(b.url ?? "");
  if (!target) return NextResponse.json({ error: "URL no válida" }, { status: 400 });
  const kind = b.kind === "vod" ? "vod" : "live";
  if (kind === "vod" && !VOD_PLATFORMS.includes(target.platform)) return NextResponse.json({ error: "Los vídeos normales solo se admiten de YouTube y TikTok." }, { status: 400 });
  const format = b.format === "audio" ? "audio" : "video";
  const quality = QUALITIES.includes(b.quality) ? b.quality : 480;
  const duration = Math.max(5, Math.floor(+b.duration || 30));
  // Directo de TikTok: no se guarda, así que se graba (hasta 3 h según el plan) y salen más clips.
  const tiktokRec = kind === "live" && target.platform === "tiktok";
  const wantCount = Math.max(1, Math.floor(+b.count || 3));

  const db = admin();
  const { data: prof } = await db.from("profiles").select("plan,trials_used,credits").eq("id", user.id).single();
  if (!prof) return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
  const adm = isAdmin(user.email);   // admin: límites del plan Premium, sin coste y sin gastar pruebas
  const plan = effectivePlan(prof.plan as PlanId, adm), isTrial = !adm && prof.plan === "trial";
  // Estilos de subtítulos según el plan (también se comprueba aquí, no solo en la web).
  if (b.subtitles === true && CAPTION_IDS.includes(b.subtitleStyle) && !captionAllowed(adm ? "premium" : prof.plan, b.subtitleStyle))
    return NextResponse.json({ error: `El estilo de subtítulos elegido es del plan ${TIER_NAME[CAPTION_TIER[b.subtitleStyle]]}. Mejora tu plan o elige otro estilo.` }, { status: 403 });
  if (quality > plan.maxQuality || duration > plan.maxDuration)
    return NextResponse.json({ error: "Tu plan no permite esa calidad o duración." }, { status: 403 });
  let windowS: number | null = null, count: number;
  if (tiktokRec) {
    const allowed = recordWindowsFor(plan);
    if (!RECORD_WINDOWS.includes(+b.window)) return NextResponse.json({ error: "Duración de grabación no válida." }, { status: 400 });
    if (!allowed.includes(+b.window)) return NextResponse.json({ error: `Tu plan permite grabar hasta ${plan.recordMin} minutos.` }, { status: 403 });
    windowS = +b.window;
    count = Math.min(wantCount, plan.recordClips, isTrial ? Math.max(1, TRIALS - prof.trials_used) : 30);
  } else {
    windowS = kind === "live" ? (AUTO_WINDOWS.includes(+b.window) ? +b.window : 120) : null;
    if (windowS && isTrial && windowS > 120) return NextResponse.json({ error: "En el trial solo se pueden analizar 2 minutos del directo." }, { status: 403 });
    count = Math.min(5, wantCount);
  }
  if (windowS && duration > windowS) return NextResponse.json({ error: "Cada clip no puede durar más que la grabación." }, { status: 400 });

  const cost = adm || isTrial ? 0 : clipCost(format, quality, duration);
  if (isTrial && prof.trials_used >= TRIALS) return NextResponse.json({ error: "Has agotado tus pruebas gratis." }, { status: 402 });
  if (!isTrial && prof.credits < cost) return NextResponse.json({ error: "No tienes créditos suficientes." }, { status: 402 });

  const { count: active } = await db.from("auto_jobs").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("status", ["queued", "analyzing"]);
  if ((active ?? 0) > 0) return NextResponse.json({ error: "Ya hay una búsqueda o grabación en curso. Espera a que termine." }, { status: 429 });

  const { data: job, error } = await db.from("auto_jobs").insert({ user_id: user.id, platform: target.platform, source_url: target.url,
    source_kind: kind, count, duration_s: duration, window_s: windowS, format, aspect: b.aspect ?? "16:9", quality, cost, is_trial: isTrial, subtitles: format === "video" && b.subtitles === true, subtitle_style: CAPTION_IDS.includes(b.subtitleStyle) ? b.subtitleStyle : DEFAULT_CAPTION, subtitle_size: subOpt(b.subtitleSize, SUB_SIZES, "m"), subtitle_position: subOpt(b.subtitlePosition, SUB_POSITIONS, "auto"), subtitle_lang: subOpt(b.subtitleLang, SUB_LANGS, "original"), framing: FRAMINGS.includes(b.framing) ? b.framing : "auto" })
    .select("id").single();
  if (error || !job) return NextResponse.json({ error: "No se pudo iniciar la búsqueda." }, { status: 500 });
  await clipQueue.add("auto", { autoId: job.id }, { attempts: 1, removeOnComplete: 1000, removeOnFail: 1000 });
  return NextResponse.json({ id: job.id }, { status: 201 });
}
