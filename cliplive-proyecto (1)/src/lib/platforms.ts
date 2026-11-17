export type Platform = "youtube" | "twitch" | "kick" | "tiktok";
export function detectPlatform(raw: string): { platform: Platform; url: string } | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname.replace(/^(www|m)\./, "");
  const p: Platform | null =
    h === "youtube.com" || h === "youtu.be" ? "youtube" :
    h === "twitch.tv" ? "twitch" : h === "kick.com" ? "kick" :
    h === "tiktok.com" ? "tiktok" : null;
  return p ? { platform: p, url: u.toString() } : null;   // lista blanca: evita SSRF
}
