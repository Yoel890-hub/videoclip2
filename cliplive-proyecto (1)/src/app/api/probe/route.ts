import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { detectPlatform } from "@/lib/platforms";
import { requireUser } from "@/lib/supabase";
const run = promisify(execFile);

// Comprueba si el directo está activo y cuánto historial (DVR) permite. Usa yt-dlp en modo solo metadatos.
export async function POST(req: Request) {
  if (!(await requireUser())) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const target = detectPlatform((await req.json()).url ?? "");
  if (!target) return NextResponse.json({ error: "URL no válida. Usa YouTube, Twitch, Kick o TikTok." }, { status: 400 });
  try {
    const { stdout } = await run("yt-dlp", ["-J", "--no-playlist", "--no-warnings", "--skip-download", target.url], { timeout: 25_000, maxBuffer: 20_000_000 });
    const info = JSON.parse(stdout);
    const live = !!info.is_live;
    // Vídeos normales: solo YouTube. Directos: cualquier plataforma admitida.
    if (!live && target.platform !== "youtube")
      return NextResponse.json({ error: "Para vídeos normales usa un enlace de YouTube. En las demás plataformas solo directos." }, { status: 422 });
    if (!live && !(info.duration > 0))
      return NextResponse.json({ error: "No se pudo leer la duración del vídeo." }, { status: 422 });
    if (!live && ["is_upcoming", "was_live_processing"].includes(info.live_status))
      return NextResponse.json({ error: "Este vídeo todavía no está disponible." }, { status: 422 });
    const heights: number[] = (info.formats ?? []).map((f: any) => f.height).filter(Boolean);
    return NextResponse.json({
      kind: live ? "live" : "vod", duration: live ? null : Math.floor(info.duration),
      platform: target.platform, url: target.url, title: info.title, thumbnail: info.thumbnail,
      videoId: target.platform === "youtube" ? info.id : null,   // para el reproductor de recorte
      channel: info.uploader, maxHeight: Math.max(0, ...heights),
      // DVR real: YouTube permite retroceder hasta ~12 h si el canal lo activa; TikTok no guarda historial.
      dvrSeconds: !live ? 0 : target.platform === "tiktok" ? 0 : target.platform === "youtube" ? 12 * 3600 : 2 * 3600,
      checkedAt: Date.now(),
    });
  } catch {
    return NextResponse.json({ error: "No se pudo comprobar el directo. Inténtalo de nuevo." }, { status: 502 });
  }
}
