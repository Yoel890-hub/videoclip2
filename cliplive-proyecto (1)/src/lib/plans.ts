// Reglas de negocio. Precios en dólares (USD).
// price = lo que se cobra cada `months` meses · credits = créditos que se dan en cada cobro (cada periodo).
// Los planes configurados en PayPal deben cobrar el mismo precio y en el mismo intervalo.
export type PlanId = "trial" | "starter" | "creator" | "pro" | "premium";
export type Plan = { name: string; price: number; months: number; credits: number; maxQuality: number; maxDuration: number; rewindMin: number; concurrent: number; recordMin: number; recordClips: number };
// recordMin / recordClips: grabación de directos de TikTok (TikTok no guarda los directos): minutos máximos y clips máximos por grabación.
export const PLANS: Record<PlanId, Plan> = {
  trial:   { name: "Prueba",  price: 0,     months: 0,  credits: 0,     maxQuality: 480,  maxDuration: 30,   rewindMin: 10,  concurrent: 1,  recordMin: 10,  recordClips: 3 },
  starter: { name: "Starter", price: 9,     months: 1,  credits: 300,   maxQuality: 720,  maxDuration: 300,  rewindMin: 30,  concurrent: 5,  recordMin: 30,  recordClips: 10 },
  creator: { name: "Creator", price: 24,    months: 2,  credits: 2000,  maxQuality: 1080, maxDuration: 900,  rewindMin: 120, concurrent: 8,  recordMin: 60,  recordClips: 15 },
  pro:     { name: "Pro",     price: 59,    months: 5,  credits: 15000, maxQuality: 1080, maxDuration: 1800, rewindMin: 720, concurrent: 12, recordMin: 120, recordClips: 20 },
  premium: { name: "Premium", price: 99,    months: 12, credits: 36000, maxQuality: 1080, maxDuration: 1800, rewindMin: 720, concurrent: 24, recordMin: 180, recordClips: 30 },
};
export const PAID_PLANS: PlanId[] = ["starter", "creator", "pro", "premium"];

// "$9", "$99.99"
export const formatPrice = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
// "al mes", "cada 2 meses", "al año"
export const periodLabel = (months: number) => (months === 1 ? "al mes" : months === 12 ? "al año" : `cada ${months} meses`);
// Equivalente mensual para comparar planes: "$8.33/mes"
export const perMonth = (p: Plan) => (p.months > 1 ? `$${(p.price / p.months).toFixed(2)}/mes` : null);
export const QUALITIES = [144, 240, 360, 480, 720, 1080] as const;
const PER_MIN: Record<number, number> = { 144: 1, 240: 1, 360: 2, 480: 2, 720: 4, 1080: 6 };
export const TRIALS = 3, REFERRAL_BONUS = 60, RETENTION_DAYS = 30;

export function clipCost(format: string, quality: number, durationS: number): number {
  if (format === "image") return 1;
  const min = Math.max(1, Math.ceil(durationS / 60));
  return format === "audio" ? min : Math.max(1, min * (PER_MIN[quality] ?? 2));
}

// Clips automáticos en directos: segundos que se graban para buscar los mejores momentos.
export const AUTO_WINDOWS = [120, 300, 600];

// Grabación de directos de TikTok: duraciones posibles (segundos). Cada plan llega hasta su recordMin.
export const RECORD_WINDOWS = [600, 1800, 3600, 7200, 10800];
export const recordWindowsFor = (p: Plan) => RECORD_WINDOWS.filter((w) => w <= p.recordMin * 60);
// Clips sugeridos según lo que dura la grabación: ~1 cada 5 minutos, sin pasar del máximo del plan.
export const suggestedClips = (windowS: number, max: number) => Math.max(1, Math.min(max, Math.round(windowS / 300)));
// ¿Este enlace es un directo de TikTok? (se graba en vez de retroceder, porque TikTok no guarda los directos)
export const isTikTokLive = (probe: { platform?: string; kind?: string }) => probe.platform === "tiktok" && probe.kind === "live";
// ¿Directo de YouTube? (guarda ~1 h hacia atrás: los momentos destacados se buscan en lo ya emitido, al momento)
export const isYoutubeLive = (probe: { platform?: string; kind?: string }) => probe.platform === "youtube" && probe.kind === "live";

// Encuadre del recorte vertical/cuadrado.
export const FRAMINGS = ["auto", "left", "center", "right"];
