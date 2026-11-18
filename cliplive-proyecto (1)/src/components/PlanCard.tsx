import Link from "next/link";
import { formatPrice, periodLabel, perMonth, PLANS, type PlanId } from "@/lib/plans";
import { captionsForPlan, CAPTION_STYLES } from "@/lib/captionStyles";

const TAGLINE: Record<PlanId, string> = {
  trial: "Para probar ClipLive",
  starter: "Para empezar a publicar",
  creator: "Para creadores constantes",
  pro: "Para streamers que suben a diario",
  premium: "Todo, todo el año, al mejor precio",
};

const Check = () => (
  <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export function planFeatures(id: PlanId) {
  const p = PLANS[id], n = captionsForPlan(id);
  return [
    `${p.credits.toLocaleString("es-ES")} créditos ${p.months === 1 ? "al mes" : p.months === 12 ? "al año" : `cada ${p.months} meses`}`,
    n >= CAPTION_STYLES.length ? `Los ${n} estilos de subtítulos` : `${n} estilos de subtítulos`,
    `Hasta ${p.maxQuality}p`,
    `Clips de hasta ${Math.round(p.maxDuration / 60)} min`,
    `Retroceder ${p.rewindMin >= 60 ? `${p.rewindMin / 60} h` : `${p.rewindMin} min`} en directos`,
    "Momentos destacados y cámara inteligente",
  ];
}

// Tarjeta de un plan (portada y página de planes). `action` sustituye al enlace por un botón propio (p. ej. pagar).
export default function PlanCard({ id, badge, highlight, href, cta, action }: {
  id: PlanId; badge?: string; highlight?: boolean; href?: string; cta?: string; action?: React.ReactNode;
}) {
  const p = PLANS[id], eq = perMonth(p);
  return (
    <div className={`relative flex flex-col rounded-3xl p-[1px] ${highlight ? "bg-gradient-to-b from-accent via-accent/40 to-line shadow-[0_0_60px_-15px_rgba(255,102,0,.6)]" : "bg-line"}`}>
      <div className="flex flex-1 flex-col rounded-[23px] bg-card p-6"
        style={highlight ? { background: "radial-gradient(400px 200px at 50% 0%, rgba(255,102,0,.16), transparent 70%), #131316" } : undefined}>
        {badge && (
          <span className={`absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${highlight ? "bg-accent text-bg" : "border border-accent/50 bg-bg text-accent"}`}>{badge}</span>
        )}
        <h3 className="text-xl font-extrabold">{p.name}</h3>
        <p className="mt-1 text-sm text-zinc-400">{TAGLINE[id]}</p>

        <div className="mt-5 flex flex-wrap items-end gap-x-1.5">
          <span className="whitespace-nowrap text-5xl font-extrabold tracking-tight [overflow-wrap:normal]">{formatPrice(p.price)}</span>
          <span className="whitespace-nowrap pb-1.5 text-sm font-medium text-zinc-400">{periodLabel(p.months)}</span>
        </div>
        <p className="mt-1 h-5 text-sm font-semibold text-accent">{eq ? `Sale a ${eq}` : ""}</p>

        {/* Lo que más diferencia a los planes: cuántos clips se crean a la vez */}
        <div className={`mt-5 flex items-center gap-3 rounded-2xl border p-3 ${highlight ? "border-accent/40 bg-accent/10" : "border-line bg-card2"}`}>
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl font-extrabold ${highlight ? "bg-accent text-bg" : "bg-bg text-accent"}`}>{p.concurrent}</span>
          <span className="text-sm leading-tight"><b className="block text-zinc-100">clips a la vez</b><span className="text-zinc-400">sin hacer cola</span></span>
        </div>

        <ul className="mt-5 flex-1 space-y-2.5 text-sm text-zinc-300">
          {planFeatures(id).map((i) => <li key={i} className="flex gap-2"><Check />{i}</li>)}
        </ul>
        <div className="mt-6">
          {action ?? <Link href={href ?? "/login?modo=registro"} className={`${highlight ? "btn-primary" : "btn-ghost"} w-full`}>{cta ?? "Empezar"}</Link>}
        </div>
      </div>
    </div>
  );
}
