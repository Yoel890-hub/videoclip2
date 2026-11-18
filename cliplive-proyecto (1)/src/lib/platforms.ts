export type Platform = "youtube" | "twitch" | "kick" | "tiktok";

// Plataformas de las que se pueden recortar vídeos ya publicados (además de directos).
export const VOD_PLATFORMS: Platform[] = ["youtube", "tiktok"];

// Dominio o cualquier subdominio (vt.tiktok.com, m.youtube.com, clips.twitch.tv…).
const is = (h: string, d: string) => h === d || h.endsWith("." + d);

export function detectPlatform(raw: string): { platform: Platform; url: string } | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname.toLowerCase();
  const p: Platform | null =
    is(h, "youtube.com") || is(h, "youtu.be") ? "youtube" :
    is(h, "twitch.tv") ? "twitch" :
    is(h, "kick.com") ? "kick" :
    is(h, "tiktok.com") ? "tiktok" : null;
  return p ? { platform: p, url: u.toString() } : null;   // lista blanca: evita SSRF
}

// Enlaces cortos de compartir de TikTok (vt.tiktok.com/…, vm.tiktok.com/…, tiktok.com/t/…).
export const isShortLink = (url: string) => {
  try {
    const u = new URL(url), h = u.hostname.toLowerCase();
    return h === "vt.tiktok.com" || h === "vm.tiktok.com" || (is(h, "tiktok.com") && u.pathname.startsWith("/t/"));
  } catch { return false; }
};

// Sigue la redirección de un enlace corto hasta el enlace real (solo dominios de TikTok, por seguridad).
export async function resolveShortLink(url: string): Promise<string> {
  let cur = url;
  for (let i = 0; i < 5 && isShortLink(cur); i++) {
    const r = await fetch(cur, { method: "GET", redirect: "manual", headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) });
    const loc = r.headers.get("location");
    if (!loc) break;
    const next = new URL(loc, cur).toString();
    if (detectPlatform(next)?.platform !== "tiktok") break;      // nunca seguir fuera de TikTok
    cur = next;
  }
  // Quitar parámetros de seguimiento (?_r=1&_t=…) que no hacen falta.
  try { const u = new URL(cur); if (is(u.hostname, "tiktok.com")) { u.search = ""; cur = u.toString(); } } catch {}
  return cur;
}
