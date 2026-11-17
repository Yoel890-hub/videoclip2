// Reglas de negocio. Precios y créditos son marcadores: ajústalos a tu modelo real.
export type PlanId = "trial" | "starter" | "creator" | "pro";
export const PLANS: Record<PlanId, { name: string; price: number; credits: number; maxQuality: number; maxDuration: number; rewindMin: number; concurrent: number }> = {
  trial:   { name: "Trial",   price: 0,  credits: 0,    maxQuality: 480,  maxDuration: 30,   rewindMin: 10,  concurrent: 1 },
  starter: { name: "Starter", price: 9,  credits: 300,  maxQuality: 720,  maxDuration: 300,  rewindMin: 30,  concurrent: 2 },
  creator: { name: "Creator", price: 24, credits: 1000, maxQuality: 1080, maxDuration: 900,  rewindMin: 120, concurrent: 3 },
  pro:     { name: "Pro",     price: 59, credits: 3000, maxQuality: 1080, maxDuration: 1800, rewindMin: 720, concurrent: 5 },
};
export const QUALITIES = [144, 240, 360, 480, 720, 1080] as const;
const PER_MIN: Record<number, number> = { 144: 1, 240: 1, 360: 2, 480: 2, 720: 4, 1080: 6 };
export const TRIALS = 3, REFERRAL_BONUS = 60, RETENTION_DAYS = 30;

export function clipCost(format: string, quality: number, durationS: number): number {
  if (format === "image") return 1;
  const min = Math.max(1, Math.ceil(durationS / 60));
  return format === "audio" ? min : Math.max(1, min * (PER_MIN[quality] ?? 2));
}
