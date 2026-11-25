// Dirección pública de la web (para Google, enlaces compartidos y el sitemap).
// Acepta "clipvideo.com" o "https://clipvideo.com/": siempre devuelve "https://clipvideo.com".
function normalize(raw: string | undefined) {
  const v = (raw ?? "").trim().replace(/\/+$/, "");
  if (!v) return null;
  const url = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try { return new URL(url).origin; } catch { return null; }
}

export const SITE_URL = normalize(process.env.NEXT_PUBLIC_SITE_URL) ?? normalize(process.env.NEXT_PUBLIC_APP_URL) ?? "https://clipvideo.com";
