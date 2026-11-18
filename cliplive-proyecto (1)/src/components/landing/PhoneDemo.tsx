"use client";
import { useEffect, useState } from "react";

// Móvil de demostración: un clip vertical con subtítulos estilo "Verde pop" y la palabra activa animada.
const PHRASES = [["ESTO", "SE", "HIZO"], ["VIRAL", "EN", "TIKTOK"], ["CON", "UN", "CLIC"]];

export default function PhoneDemo() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setTick((n) => n + 1), 550);
    return () => clearInterval(t);
  }, []);
  const words = PHRASES[Math.floor(tick / 3) % PHRASES.length], active = tick % 3;

  return (
    <div className="relative mx-auto w-[240px] sm:w-[270px]" aria-hidden>
      <div className="absolute -inset-8 rounded-[3rem] bg-accent/20 blur-3xl" />
      <div className="relative aspect-[9/19] overflow-hidden rounded-[2.4rem] border-[6px] border-zinc-800 bg-black shadow-2xl">
        {/* "Vídeo": escena abstracta con una persona */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#3b1d5a] via-[#1d2b5a] to-[#0b0b10]" />
        <div className="absolute left-1/2 top-[22%] h-24 w-24 -translate-x-1/2 rounded-full bg-gradient-to-b from-[#f2c7a5] to-[#d79c76]" />
        <div className="absolute left-1/2 top-[40%] h-56 w-44 -translate-x-1/2 rounded-t-[5rem] bg-gradient-to-b from-accent to-[#b84a00]" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-3 text-[10px] font-semibold text-white/80">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />EN DIRECTO</span>
          <span>0:{String(12 + (tick % 18)).padStart(2, "0")}</span>
        </div>
        {/* Subtítulo */}
        <p className="absolute inset-x-0 bottom-[18%] text-center text-[22px] leading-none" style={{ fontFamily: "'Arial Black', Arial, sans-serif", fontWeight: 900, color: "#fff", WebkitTextStroke: "4px #000", paintOrder: "stroke fill" }}>
          {words.map((w, i) => (
            <span key={w + i} className="inline-block transition-all duration-150" style={i === active ? { color: "#39FF14", transform: "scale(1.15)" } : undefined}>{w}&nbsp;</span>
          ))}
        </p>
        {/* Barra de progreso del vídeo */}
        <div className="absolute inset-x-4 bottom-4 h-1 overflow-hidden rounded-full bg-white/20">
          <div className="h-full bg-white transition-all duration-500" style={{ width: `${(tick % 18) * 5.5 + 2}%` }} />
        </div>
      </div>
    </div>
  );
}
