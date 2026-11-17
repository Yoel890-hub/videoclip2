import { NextResponse } from "next/server";
import { detectPlatform } from "@/lib/platforms";
import { PLANS, clipCost, QUALITIES, type PlanId } from "@/lib/plans";
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
  if (kind === "vod" && target.platform !== "youtube") return NextResponse.json({ error: "Los vídeos normales solo se admiten en YouTube." }, { status: 400 });
  const start = kind === "live" ? Math.max(0, Math.floor(+b.startOffset || 0)) : 0;
  const startAt = kind === "vod" ? Math.max(0, Math.floor(+b.startAt || 0)) : null;
  const duration = format === "image" ? 1 : Math.max(5, Math.floor(+b.duration || 30));

  const db = admin();
  const { data: prof } = await db.from("profiles").select("plan,trials_used,credits").eq("id", user.id).single();
  if (!prof) return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
  const plan = PLANS[prof.plan as PlanId];
  // Los límites se validan siempre en el servidor, no solo en la interfaz.
  if (format !== "image" && (quality > plan.maxQuality || duration > plan.maxDuration))
    return NextResponse.json({ error: "Tu plan no permite esa calidad o duración." }, { status: 403 });
  if (kind === "live" && start > plan.rewindMin * 60) return NextResponse.json({ error: "Tu plan no permite retroceder tanto." }, { status: 403 });
  const { count } = await db.from("clips").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("status", ["queued", "processing"]);
  if ((count ?? 0) >= plan.concurrent) return NextResponse.json({ error: "Has alcanzado el máximo de clips simultáneos." }, { status: 429 });

  const isTrial = prof.plan === "trial";
  const cost = isTrial ? 0 : clipCost(format, quality, duration);
  const { data: id, error } = await db.rpc("create_clip", { p_user: user.id, p_platform: target.platform, p_url: target.url,
    p_format: format, p_aspect: b.aspect ?? "16:9", p_quality: quality, p_start: start, p_duration: duration, p_cost: cost, p_trial: isTrial, p_kind: kind, p_start_at: startAt });
  if (error) {
    const msg = error.message.includes("NO_CREDITS") ? "No tienes créditos suficientes." : error.message.includes("NO_TRIALS") ? "Has agotado tus pruebas gratis." : "No se pudo crear el clip.";
    return NextResponse.json({ error: msg }, { status: 402 });
  }
  await clipQueue.add("capture", { clipId: id }, { attempts: 1, removeOnComplete: 1000, removeOnFail: 1000 });
  return NextResponse.json({ id, cost }, { status: 201 });
}
