import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { detectPlatform, isShortLink, resolveShortLink, VOD_PLATFORMS } from "@/lib/platforms";
import { requireUser } from "@/lib/supabase";
const run = promisify(execFile);

const NAMES: Record<string, string> = { youtube: "YouTube", twitch: "Twitch", kick: "Kick", tiktok: "TikTok" };

// Comprueba el enlace (directo o vídeo) y cuánto historial (DVR) permite. Usa yt-dlp en modo solo metadatos.
export async function POST(req: Request) {
  if (!(await requireUser())) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  let target = detectPlatform((await req.json()).url ?? "");
  if (!target) return NextResponse.json({ error: "URL no válida. Usa YouTube, Twitch, Kick o TikTok." }, { status: 400 });

  // TikTok: el botón "Compartir" da enlaces cortos (vt.tiktok.com/…) → se convierten en el enlace real.
  if (isShortLink(target.url)) {
    try { target = detectPlatform(await resolveShortLink(target.url)) ?? target; } catch { /* se intenta con el corto */ }
  }
  // TikTok: el enlace de un perfil (tiktok.com/@usuario) se trata como su directo.
  if (target.platform === "tiktok") {
    const u = new URL(target.url);
    if (/^\/@[^/]+\/?$/.test(u.pathname)) { u.pathname = u.pathname.replace(/\/?$/, "/live"); target = { ...target, url: u.toString() }; }
  }

  try {
    const { stdout } = await run("yt-dlp", ["-J", "--no-playlist", "--no-warnings", "--skip-download", target.url], { timeout: 30_000, maxBuffer: 20_000_000 });
    const info = JSON.parse(stdout);
    const live = !!info.is_live;
    if (!live && !VOD_PLATFORMS.includes(target.platform))
      return NextResponse.json({ error: `De ${NAMES[target.platform]} solo se pueden sacar clips de directos. Para vídeos usa YouTube o TikTok.` }, { status: 422 });
    if (!live && !(info.duration > 0))
      return NextResponse.json({ error: "No se pudo leer la duración del vídeo." }, { status: 422 });
    if (!live && ["is_upcoming", "was_live_processing"].includes(info.live_status))
      return NextResponse.json({ error: "Este vídeo todavía no está disponible." }, { status: 422 });
    const heights: number[] = (info.formats ?? []).map((f: any) => f.height).filter(Boolean);
    return NextResponse.json({
      kind: live ? "live" : "vod", duration: live ? null : Math.floor(info.duration),
      platform: target.platform, url: target.url, title: info.title || info.description?.slice(0, 80) || "Vídeo de " + NAMES[target.platform],
      thumbnail: info.thumbnail, channel: info.uploader ?? info.channel,
      videoId: target.platform === "youtube" ? info.id : null,   // para el reproductor de recorte
      maxHeight: Math.max(0, ...heights),
      // DVR real: YouTube permite retroceder hasta ~12 h si el canal lo activa; TikTok no guarda historial.
      dvrSeconds: !live ? 0 : target.platform === "tiktok" ? 0 : target.platform === "youtube" ? 12 * 3600 : 2 * 3600,
      checkedAt: Date.now(),
    });
  } catch (e: any) {
    const msg = String(e?.stderr ?? e?.message ?? "");
    if (/not currently live|is offline|not live/i.test(msg))
      return NextResponse.json({ error: "Ese directo no está en emisión ahora mismo." }, { status: 422 });
    if (target.platform === "tiktok" && /403|forbidden/i.test(msg))
      return NextResponse.json({ error: "TikTok ha bloqueado la descarga automática de este vídeo. Prueba de nuevo en unos minutos o usa otro enlace." }, { status: 422 });
    if (/private|login|sign in|age/i.test(msg))
      return NextResponse.json({ error: "Ese vídeo es privado o necesita iniciar sesión, y no se puede descargar." }, { status: 422 });
    return NextResponse.json({ error: "No se pudo comprobar el enlace. Revisa que sea correcto e inténtalo de nuevo." }, { status: 502 });
  }
}
