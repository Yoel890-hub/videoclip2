"use client";
export default function PlanButton({ plan, current }: { plan: string; current: boolean }) {
  return <button className="btn-primary w-full" disabled={current} onClick={async () => {
    const r = await fetch("/api/checkout", { method: "POST", body: JSON.stringify({ plan }) });
    const j = await r.json(); if (j.url) location.href = j.url;
  }}>{current ? "Plan actual" : "Elegir plan"}</button>;
}
