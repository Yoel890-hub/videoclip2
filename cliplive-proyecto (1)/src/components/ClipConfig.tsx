"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PLANS, QUALITIES, clipCost, type PlanId } from "@/lib/plans";

const STARTS = [{ l: "En vivo", s: 0 }, { l: "1m", s: 60 }, { l: "2m", s: 120 }, { l: "5m", s: 300 }, { l: "10m", s: 600 }, { l: "30m", s: 1800 }, { l: "60m", s: 3600 }, { l: "120m", s: 7200 }];

export default function ClipConfig({ plan, credits }: { plan: PlanId; credits: number }) {
  const P = PLANS[plan], router = useRouter();
  const [probe, setProbe] = useState<any>(null);
  const [format, setFormat] = useState("video"), [aspect, setAspect] = useState("16:9");
  const [start, setStart] = useState(0), [duration, setDuration] = useState(30), [quality, setQuality] = useState(480);
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false), [startAt, setStartAt] = useState("0:00");
  useEffect(() => { try { setProbe(JSON.parse(sessionStorage.getItem("probe") ?? "null")); } catch {} }, []);
  if (!probe) return <p className="text-zinc-400">Primero verifica un directo desde el Workspace.</p>;

  const vod = probe.kind === "vod";
  const startSec = parseClock(startAt);
  const room = vod ? Math.max(0, probe.duration - (startSec ?? 0)) : P.maxDuration;   // segundos que quedan hasta el final del vídeo
  const maxDur = Math.min(P.maxDuration, room);
  const dur = Math.min(duration, Math.max(1, maxDur));
  const cost = plan === "trial" ? 0 : clipCost(format, quality, dur);
  const maxStart = Math.min(P.rewindMin * 60, probe.dvrSeconds);
  const create = async () => {
    setBusy(true); setErr("");
    const r = await fetch("/api/clips", { method: "POST", body: JSON.stringify({ url: probe.url, format, aspect, kind: probe.kind, startOffset: start, startAt: startSec, duration: dur, quality }) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) return setErr(j.error);
    router.push("/clips"); router.refresh();
  };
  return (
    <div className="space-y-6">
      <div className="card flex gap-3">{probe.thumbnail && <img src={probe.thumbnail} alt="" className="h-16 w-28 rounded-lg object-cover" />}
        <div className="min-w-0"><p className="label">{probe.platform} · {vod ? `vídeo · ${fmtClock(probe.duration)}` : "en vivo"}</p><p className="truncate font-semibold">{probe.title}</p></div></div>
      <Group label="Formato">{[["video", "Video"], ["audio", "Audio"], ["image", "Captura"]].map(([v, l]) => <Chip key={v} on={format === v} onClick={() => setFormat(v)}>{l}</Chip>)}</Group>
      {format === "video" && <Group label="Proporción">{["16:9", "9:16", "1:1"].map((a) => <Chip key={a} on={aspect === a} onClick={() => setAspect(a)}>{a}</Chip>)}</Group>}
      {vod ? (
        <div><p className="label mb-2">Empieza en (mm:ss o h:mm:ss)</p>
          <input className="input" inputMode="numeric" value={startAt} onChange={(e) => setStartAt(e.target.value)} aria-invalid={startSec === null || startSec >= probe.duration} />
          <p className="mt-1 text-sm text-zinc-400">El vídeo dura {fmtClock(probe.duration)}.{startSec === null && " Formato no válido."}{startSec !== null && startSec >= probe.duration && " Esa posición está fuera del vídeo."}</p></div>
      ) : <>
      <Group label="Empezar desde">{STARTS.map((o) => <Chip key={o.s} on={start === o.s} disabled={o.s > maxStart} onClick={() => setStart(o.s)}>{o.l}</Chip>)}</Group>
      <p className="card text-sm text-zinc-300">{probe.dvrSeconds > 0 ? `Historial comprobado: hasta ${Math.round(probe.dvrSeconds / 3600)} h atrás.` : "Este directo no guarda historial: se grabará desde ahora."}</p></>}
      {format !== "image" && <>
        <div><div className="flex items-end justify-between"><p className="label">Duración del clip</p><p className="text-3xl font-extrabold">{dur >= 60 ? `${Math.round(dur / 60)} min` : `${dur} s`}</p></div>
          <input type="range" className="mt-3 w-full accent-orange-500" min={Math.min(5, Math.max(1, maxDur))} max={Math.max(1, maxDur)} step={1} value={dur} onChange={(e) => setDuration(+e.target.value)} /></div>
        {format === "video" && <Group label="Calidad de video">{QUALITIES.map((q) => <Chip key={q} on={quality === q} disabled={q > P.maxQuality || q > (probe.maxHeight || 1080)} onClick={() => setQuality(q)}>{q}p</Chip>)}</Group>}
      </>}
      <div className="card"><p className="label">Coste estimado</p><p className="text-2xl font-extrabold">{plan === "trial" ? "Prueba gratis" : `${cost} créditos`}</p>
        <p className="text-sm text-zinc-400">Los clips se guardan 30 días. Si falla, se devuelven los créditos.</p></div>
      <p className="text-sm text-red-400" role="alert">{err}</p>
      <button className="btn-primary w-full text-lg" disabled={busy || (vod && (startSec === null || startSec >= probe.duration)) || (plan !== "trial" && cost > credits)} onClick={create}>
        {busy ? "Creando…" : `Crear clip · ${plan === "trial" ? "gratis" : `${cost} cr`}`}</button>
    </div>
  );
}
function parseClock(v: string): number | null {
  const m = v.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$|^(\d+)$/);
  if (!m) return null;
  if (m[4] !== undefined) return +m[4];
  return (+(m[1] ?? 0)) * 3600 + +m[2] * 60 + +m[3];
}
function fmtClock(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`;
}
const Group = ({ label, children }: any) => <div><p className="label mb-2">{label}</p><div className="flex flex-wrap gap-2">{children}</div></div>;
const Chip = ({ on, children, ...p }: any) => <button type="button" aria-pressed={on} className="chip" {...p}>{children}</button>;
