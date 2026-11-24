import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const NAMES = { youtube: "YouTube", twitch: "Twitch", kick: "Kick", tiktok: "TikTok" };

export function youtubeBlocked(error) {
  return /confirm (?:that )?you(?:['’]re| are) not a bot/i.test(String(error?.stderr || error?.message || ""));
}

async function youtubeDvrSeconds(info) {
  const video = (info.formats ?? []).find((format) => String(format.protocol).startsWith("m3u8") && format.height);
  if (!video) return 0;
  try {
    const playlist = await fetch(video.url, { signal: AbortSignal.timeout(8_000) });
    if (!playlist.ok) return 0;
    const segments = (await playlist.text()).matchAll(/#EXTINF:([\d.]+)/g);
    const total = [...segments].reduce((sum, match) => sum + Number(match[1]), 0);
    return Math.max(0, Math.floor(total) - 15);
  } catch { return 0; }
}

export async function probeMedia(platform, url) {
  try {
    const { stdout } = await run("yt-dlp", ["-J", "--no-playlist", "--no-warnings", "--skip-download", url], {
      timeout: 30_000, maxBuffer: 20_000_000,
    });
    const info = JSON.parse(stdout);
    const live = Boolean(info.is_live);
    if (!live && platform === "tiktok") {
      return { status: 422, body: { error: "De TikTok solo se pueden sacar clips de directos." } };
    }
    if (!live && ["is_upcoming", "was_live_processing"].includes(info.live_status)) {
      return { status: 422, body: { error: "Este vídeo todavía no está disponible." } };
    }
    if (!live && !(info.duration > 0)) {
      return { status: 422, body: { error: "No se pudo leer la duración del vídeo." } };
    }
    const heights = (info.formats ?? []).map((format) => format.height).filter(Boolean);
    const dvrSeconds = !live || platform === "tiktok" ? 0 : platform === "youtube" ? await youtubeDvrSeconds(info) : 2 * 3600;
    return { status: 200, body: {
      kind: live ? "live" : "vod", duration: live ? null : Math.floor(info.duration), platform, url,
      title: info.title || info.description?.slice(0, 80) || "Vídeo de " + NAMES[platform],
      thumbnail: info.thumbnail, channel: info.uploader ?? info.channel,
      videoId: platform === "youtube" ? info.id : null, maxHeight: Math.max(0, ...heights), dvrSeconds, checkedAt: Date.now(),
    } };
  } catch (error) {
    const message = String(error?.stderr || error?.message || "");
    console.error("probe", platform, message.trim().split("\n").filter(Boolean).slice(-2).join(" | ").slice(0, 400));
    if (platform === "youtube" && youtubeBlocked(error)) {
      return { status: 503, body: { error: "YouTube pidió verificar que la consulta viene de una persona. ClipLive no pudo abrir el vídeo.", code: "YOUTUBE_VERIFICATION" } };
    }
    if (/not currently live|is offline|not live/i.test(message)) {
      return { status: 422, body: { error: "Ese directo no está en emisión ahora mismo." } };
    }
    if (platform === "tiktok" && /403|forbidden/i.test(message)) {
      return { status: 422, body: { error: "TikTok ha bloqueado la descarga automática de este vídeo. Prueba de nuevo en unos minutos o usa otro enlace." } };
    }
    if (/private|login|sign in|age[- ]restricted|confirm your age/i.test(message)) {
      return { status: 422, body: { error: "Ese vídeo es privado o necesita iniciar sesión, y no se puede descargar." } };
    }
    return { status: 502, body: { error: "No se pudo comprobar el enlace. Revisa que sea correcto e inténtalo de nuevo." } };
  }
}
