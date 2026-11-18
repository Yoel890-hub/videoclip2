"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CAPTION_STYLES, CAPTION_TIER, TIER_NAME, captionAllowed, type Tier } from "@/lib/captionStyles";

/**
 * Cuadrícula de estilos de subtítulos con la palabra activa animada.
 * plan: los estilos de planes superiores salen bloqueados (candado + plan necesario).
 * Sin plan (portada) todos se pueden probar, mostrando de qué plan es cada uno.
 */
export default function CaptionPicker({ value, onChange, plan }: { value: string | null; onChange: (v: string | null) => void; plan?: string }) {
  const [tick, setTick] = useState(0), [locked, setLocked] = useState<Tier | null>(null);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setTick((n) => n + 1), 650);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Estilo de subtítulos">
        <Tile on={value === null} onClick={() => { setLocked(null); onChange(null); }} label="Sin subtítulos">
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-zinc-500" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" />
          </svg>
        </Tile>
        {CAPTION_STYLES.map((s) => {
          const words = s.sample.filter(Boolean) as string[];
          const single = !s.sample[0];
          const i = tick % words.length;
          const tier = CAPTION_TIER[s.id] ?? "premium";
          const blocked = plan !== undefined && !captionAllowed(plan, s.id);
          return (
            <Tile key={s.id} on={value === s.id} locked={blocked} label={s.name}
              tag={tier !== "trial" && (plan === undefined || blocked) ? TIER_NAME[tier] : undefined}
              onClick={() => { if (blocked) return setLocked(tier); setLocked(null); onChange(s.id); }}>
              <span className="whitespace-nowrap text-[14px] leading-none sm:text-[16px]" style={s.base}>
                {single ? words[0] : words.map((w, j) => (
                  <span key={j} className="inline-block transition-all duration-150" style={j === i ? s.active : undefined}>{w}{j < words.length - 1 ? " " : ""}</span>
                ))}
              </span>
            </Tile>
          );
        })}
      </div>
      {locked && (
        <p className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm" role="status">
          <span>Este estilo se desbloquea con el plan <b className="text-accent">{TIER_NAME[locked]}</b> o superior.</span>
          <Link href="/planes" className="font-semibold text-accent hover:underline">Ver planes →</Link>
        </p>
      )}
    </div>
  );
}

function Tile({ on, locked, onClick, label, tag, children }: { on: boolean; locked?: boolean; onClick: () => void; label: string; tag?: string; children: React.ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={on} aria-disabled={locked || undefined} onClick={onClick}
      title={locked ? `${label} · plan ${tag}` : label}
      className={`group relative flex flex-col items-center justify-between gap-1 overflow-hidden rounded-xl border-2 bg-[#2a2a2e] px-1 pb-1.5 pt-3 transition ${on ? "border-accent" : "border-transparent hover:border-zinc-600"}`}>
      {tag && (
        <span className={`absolute right-1 top-1 flex items-center gap-0.5 rounded-md px-1 py-px text-[9px] font-bold uppercase tracking-wide ${locked ? "bg-black/70 text-zinc-300" : "bg-accent/20 text-accent"}`}>
          {locked && <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>}
          {tag}
        </span>
      )}
      <span className={`flex h-10 items-center justify-center ${locked ? "opacity-35 grayscale-[40%]" : ""}`}>{children}</span>
      <span className={`text-[11px] font-semibold ${on ? "text-accent" : locked ? "text-zinc-500" : "text-zinc-400"}`}>{label}</span>
    </button>
  );
}
