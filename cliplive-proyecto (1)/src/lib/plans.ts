// Reglas de negocio. Precios en dólares (USD).
// price = lo que se cobra cada `months` meses · credits = créditos que se dan en cada cobro (cada periodo).
// Los precios reales los cobra Stripe: cada plan necesita su precio recurrente con el mismo intervalo (ver README).
export type PlanId = "trial" | "starter" | "creator" | "pro" | "premium";
export type Plan = { name: string; price: number; months: number; credits: number; maxQuality: number; maxDuration: number; rewindMin: number; concurrent: number };
export const PLANS: Record<PlanId, Plan> = {
  trial:   { name: "Prueba",  price: 0,     months: 0,  credits: 0,     maxQuality: 480,  maxDuration: 30,   rewindMin: 10,  concurrent: 1 },
  starter: { name: "Starter", price: 9,     months: 1,  credits: 300,   maxQuality: 720,  maxDuration: 300,  rewindMin: 30,  concurrent: 5 },
  creator: { name: "Creator", price: 24,    months: 2,  credits: 2000,  maxQuality: 1080, maxDuration: 900,  rewindMin: 120, concurrent: 8 },
  pro:     { name: "Pro",     price: 59,    months: 5,  credits: 15000, maxQuality: 1080, maxDuration: 1800, rewindMin: 720, concurrent: 12 },
  premium: { name: "Premium", price: 99,    months: 12, credits: 36000, maxQuality: 1080, maxDuration: 1800, rewindMin: 720, concurrent: 24 },
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

// Encuadre del recorte vertical/cuadrado.
export const FRAMINGS = ["auto", "left", "center", "right"];
