import { NextResponse } from "next/server";
import { detectPlatform, VOD_PLATFORMS } from "@/lib/platforms";
import { clipCost, QUALITIES, FRAMINGS, type PlanId } from "@/lib/plans";
import { isAdmin, effectivePlan } from "@/lib/admin";
import { CAPTION_IDS, DEFAULT_CAPTION, SUB_SIZES, SUB_POSITIONS, SUB_LANGS, subOpt, captionAllowed, CAPTION_TIER, TIER_NAME } from "@/lib/captionStyles";
import { admin, requireUser } from "@/lib/supabase";
import { clipQueue } from "@/lib/queue";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { data } = await admin().from("clips").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const b = await req.json();
  const target = detectPlatform(b.url ?? "");
  if (!target) return NextResponse.json({ error: "URL no válida" }, { status: 400 });
  const format = ["video", "audio", "image"].includes(b.format) ? b.format : "video";
  const quality = QUALITIES.includes(b.quality) ? b.quality : 480;
  const kind = b.kind === "vod" ? "vod" : "live";
  if (kind === "vod" && !VOD_PLATFORMS.includes(target.platform)) return NextResponse.json({ error: "Los vídeos normales solo se admiten de YouTube y TikTok." }, { status: 400 });
  const start = kind === "live" ? Math.max(0, Math.floor(+b.startOffset || 0)) : 0;
  const startAt = kind === "vod" ? Math.max(0, Math.floor(+b.startAt || 0)) : null;
  const duration = format === "image" ? 1 : Math.max(5, Math.floor(+b.duration || 30));

  const db = admin();
  const { data: prof } = await db.from("profiles").select("plan,trials_used,credits").eq("id", user.id).single();
  if (!prof) return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
  const adm = isAdmin(user.email);   // admin: límites del plan Premium, sin coste y sin gastar pruebas
  const plan = effectivePlan(prof.plan as PlanId, adm);
  // Estilos de subtítulos según el plan (también se comprueba aquí, no solo en la web).
  if (b.subtitles === true && CAPTION_IDS.includes(b.subtitleStyle) && !captionAllowed(adm ? "premium" : prof.plan, b.subtitleStyle))
    return NextResponse.json({ error: `El estilo de subtítulos elegido es del plan ${TIER_NAME[CAPTION_TIER[b.subtitleStyle]]}. Mejora tu plan o elige otro estilo.` }, { status: 403 });
  // Los límites se validan siempre en el servidor, no solo en la interfaz.
  if (format !== "image" && (quality > plan.maxQuality || duration > plan.maxDuration))
    return NextResponse.json({ error: "Tu plan no permite esa calidad o duración." }, { status: 403 });
  if (kind === "live" && start > plan.rewindMin * 60) return NextResponse.json({ error: "Tu plan no permite retroceder tanto." }, { status: 403 });
  const { count } = await db.from("clips").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("status", ["queued", "processing"]);
  if ((count ?? 0) >= plan.concurrent) return NextResponse.json({ error: "Has alcanzado el máximo de clips simultáneos." }, { status: 429 });

  const isTrial = !adm && prof.plan === "trial";
  const cost = adm || isTrial ? 0 : clipCost(format, quality, duration);
  const { data: id, error } = await db.rpc("create_clip", { p_user: user.id, p_platform: target.platform, p_url: target.url,
    p_format: format, p_aspect: b.aspect ?? "16:9", p_quality: quality, p_start: start, p_duration: duration, p_cost: cost, p_trial: isTrial, p_kind: kind, p_start_at: startAt });
  if (error) {
    const msg = error.message.includes("NO_CREDITS") ? "No tienes créditos suficientes." : error.message.includes("NO_TRIALS") ? "Has agotado tus pruebas gratis." : "No se pudo crear el clip.";
    return NextResponse.json({ error: msg }, { status: 402 });
  }
  // Opciones extra del vídeo: subtítulos (con estilo) y encuadre.
  if (format === "video") await db.from("clips").update({ subtitles: b.subtitles === true, subtitle_style: CAPTION_IDS.includes(b.subtitleStyle) ? b.subtitleStyle : DEFAULT_CAPTION, subtitle_size: subOpt(b.subtitleSize, SUB_SIZES, "m"), subtitle_position: subOpt(b.subtitlePosition, SUB_POSITIONS, "auto"), subtitle_lang: subOpt(b.subtitleLang, SUB_LANGS, "original"), framing: FRAMINGS.includes(b.framing) ? b.framing : "center" }).eq("id", id);
  await clipQueue.add("capture", { clipId: id }, { attempts: 1, removeOnComplete: 1000, removeOnFail: 1000 });
  return NextResponse.json({ id, cost }, { status: 201 });
}
