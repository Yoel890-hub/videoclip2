"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PLANS, QUALITIES, AUTO_WINDOWS, clipCost, type PlanId } from "@/lib/plans";
import Trimmer from "@/components/Trimmer";
import CaptionPicker from "@/components/CaptionPicker";
import { CAPTION_STYLES, SUB_SIZES, SUB_POSITIONS, SUB_LANGS } from "@/lib/captionStyles";
import { SparklesIcon, VideoIcon, HeadphonesIcon, ImageIcon, LiveDot } from "@/components/Icons";

const STARTS = [{ l: "En vivo", s: 0 }, { l: "1m", s: 60 }, { l: "2m", s: 120 }, { l: "5m", s: 300 }, { l: "10m", s: 600 }, { l: "30m", s: 1800 }, { l: "60m", s: 3600 }, { l: "120m", s: 7200 }];
const FORMATS = [{ v: "video", l: "Vídeo", I: VideoIcon }, { v: "audio", l: "Audio", I: HeadphonesIcon }, { v: "image", l: "Captura", I: ImageIcon }];
const FRAMING_OPTS = [["auto", "Automático", "Sigue las caras"], ["left", "Izquierda", ""], ["center", "Centro", ""], ["right", "Derecha", ""]];
const FRAMING_LABEL: Record<string, string> = { auto: "encuadre automático", left: "encuadre izquierda", center: "encuadre centro", right: "encuadre derecha" };
const PLATFORM: Record<string, string> = { youtube: "YouTube", twitch: "Twitch", kick: "Kick", tiktok: "TikTok" };

export default function ClipConfig({ plan, credits, trialsLeft, isAdmin = false }: { plan: PlanId; credits: number; trialsLeft: number; isAdmin?: boolean }) {
  // Admin: límites del plan Pro, gratis e ilimitado.
  const P = isAdmin ? PLANS.premium : PLANS[plan], router = useRouter();
  const [probe, setProbe] = useState<any>(null);
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [count, setCount] = useState(3), [win, setWin] = useState(120);
  const [format, setFormat] = useState("video"), [aspect, setAspect] = useState("9:16"), [subStyle, setSubStyle] = useState<string | null>(null), [subSize, setSubSize] = useState("m"), [subPos, setSubPos] = useState("auto"), [subLang, setSubLang] = useState("original"), [framing, setFraming] = useState("auto");
  const [start, setStart] = useState(0), [duration, setDuration] = useState(30), [quality, setQuality] = useState(480);
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false), [startAt, setStartAt] = useState("0:00");
  useEffect(() => { try { setProbe(JSON.parse(sessionStorage.getItem("probe") ?? "null")); } catch {} }, []);
  if (!probe) return (
    <div className="card flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-zinc-400">Primero pega el enlace de un directo o vídeo.</p>
      <Link href="/" className="btn-primary">Ir a crear</Link>
    </div>
  );

  const isTrial = !isAdmin && plan === "trial", auto = mode === "auto", vod = probe.kind === "vod";
  const fmt = auto && format === "image" ? "video" : format;
  const video = fmt === "video";
  const subs = subStyle !== null;
  const cropped = video && aspect !== "16:9";
  const startSec = parseClock(startAt);
  const maxStart = Math.min(P.rewindMin * 60, probe.dvrSeconds);

  // Duración máxima según modo
  const room = auto ? (vod ? probe.duration : win) : vod ? Math.max(0, probe.duration - (startSec ?? 0)) : P.maxDuration;
  const maxDur = Math.min(P.maxDuration, room);
  const dur = Math.min(duration, Math.max(auto ? 5 : 1, maxDur));
  const perClip = isAdmin || isTrial ? 0 : clipCost(fmt, quality, dur);
  const maxCount = isTrial ? Math.max(1, Math.min(5, trialsLeft)) : 5;
  const n = auto ? Math.min(count, maxCount) : 1;
  const total = perClip * n;
  const badStart = !auto && vod && (startSec === null || startSec >= probe.duration);
  const cantPay = isAdmin ? false : isTrial ? trialsLeft < n : total > credits;

  const submit = async () => {
    setBusy(true); setErr("");
    const body = auto
      ? { url: probe.url, kind: probe.kind, format: fmt, aspect, quality, duration: dur, count: n, window: win, subtitles: video && subs, subtitleStyle: subStyle, subtitleSize: subSize, subtitlePosition: subPos, subtitleLang: subLang, framing }
      : { url: probe.url, format: fmt, aspect, kind: probe.kind, startOffset: start, startAt: startSec, duration: dur, quality, subtitles: video && subs, subtitleStyle: subStyle, subtitleSize: subSize, subtitlePosition: subPos, subtitleLang: subLang, framing };
    const r = await fetch(auto ? "/api/auto" : "/api/clips", { method: "POST", body: JSON.stringify(body) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) return setErr(j.error);
    router.push("/clips"); router.refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        {/* Modo */}
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-card p-1">
          <ModeBtn on={!auto} onClick={() => setMode("manual")} title="Elegir yo el momento" sub="Tú marcas dónde empieza" />
          <ModeBtn on={auto} onClick={() => setMode("auto")} title={<><SparklesIcon className="h-4 w-4" />Momentos destacados</>} sub="Buscamos los mejores por ti" />
        </div>
        {auto && (
          <p className="rounded-2xl border border-accent/30 bg-accent/5 p-4 text-sm text-zinc-300">
            {vod ? "Analizamos el audio del vídeo (y lo más visto en YouTube, si está disponible) para encontrar los momentos con más intensidad, y creamos clips al azar entre los mejores."
              : `Grabamos ${win / 60} min del directo desde ahora, buscamos los momentos con más intensidad (gritos, risas, aplausos…) y creamos clips al azar entre los mejores.`}
          </p>
        )}

        <Section title="Formato">
          <Row>{FORMATS.filter((o) => !auto || o.v !== "image").map(({ v, l, I }) =>
            <Chip key={v} on={fmt === v} onClick={() => setFormat(v)}><span className="flex items-center gap-1.5"><I />{l}</span></Chip>)}</Row>
          {video && <>
            <SubLabel>Proporción</SubLabel>
            <Row>{[["9:16", "Vertical 9:16", "TikTok · Reels · Shorts"], ["16:9", "Horizontal 16:9", "YouTube"], ["1:1", "Cuadrado 1:1", "Instagram"]].map(([a, l, d]) =>
              <Chip key={a} on={aspect === a} onClick={() => setAspect(a)}><span className="block">{l}</span><span className="block text-[11px] font-normal text-zinc-400">{d}</span></Chip>)}</Row>
            <SubLabel>Subtítulos</SubLabel>
            <CaptionPicker value={subStyle} onChange={setSubStyle} plan={isAdmin ? "premium" : plan} />
            {subs && (
              <div className="grid gap-3 rounded-xl border border-line bg-card2/50 p-3 sm:grid-cols-3">
                <div className="space-y-1.5"><SubLabel>Tamaño</SubLabel>
                  <Row>{SUB_SIZES.map(([v, l]) => <Chip key={v} on={subSize === v} onClick={() => setSubSize(v)}>{l}</Chip>)}</Row></div>
                <div className="space-y-1.5 sm:col-span-2"><SubLabel>Posición</SubLabel>
                  <Row>{SUB_POSITIONS.map(([v, l, d]) => <Chip key={v} on={subPos === v} onClick={() => setSubPos(v)}>
                    <span className="block">{l}</span>{d && <span className="block text-[11px] font-normal text-zinc-400">{d}</span>}</Chip>)}</Row></div>
                <div className="space-y-1.5 sm:col-span-3"><SubLabel>Idioma</SubLabel>
                  <Row>{SUB_LANGS.map(([v, l, d]) => <Chip key={v} on={subLang === v} onClick={() => setSubLang(v)}>
                    <span className="block">{l}</span>{d && <span className="block text-[11px] font-normal text-zinc-400">{d}</span>}</Chip>)}</Row></div>
              </div>
            )}
            {subs && <p className="text-xs text-zinc-400">Se generan automáticamente a partir de la voz, en el idioma original, y se ponen dentro del vídeo. Tarda un poco más.</p>}
            {cropped && <>
              <SubLabel>Encuadre</SubLabel>
              <Row>{FRAMING_OPTS.map(([v, l, d]) =>
                <Chip key={v} on={framing === v} onClick={() => setFraming(v)}>
                  <span className="flex items-center gap-1.5">{v === "auto" && <SparklesIcon className="h-3.5 w-3.5" />}{l}</span>
                  {d && <span className="block text-[11px] font-normal text-zinc-400">{d}</span>}
                </Chip>)}</Row>
              <p className="text-xs text-zinc-400">{framing === "auto" ? "El recorte se mueve solo para seguir a las personas que salen en el vídeo." : "Qué parte del vídeo horizontal se queda en el recorte."}</p>
            </>}
          </>}
        </Section>

        <Section title={auto ? "Clips" : "Momento"}>
          {auto ? <>
            <SubLabel>¿Cuántos clips?</SubLabel>
            <Row>{[1, 2, 3, 4, 5].map((k) => <Chip key={k} on={n === k} disabled={k > maxCount} onClick={() => setCount(k)}>{k}</Chip>)}</Row>
            {!vod && <><SubLabel>Tiempo de directo a analizar</SubLabel>
              <Row>{AUTO_WINDOWS.map((w) => <Chip key={w} on={win === w} disabled={isTrial && w > 120} onClick={() => setWin(w)}>{w / 60} min</Chip>)}</Row></>}
          </> : vod ? <>
            {probe.videoId && (
              <Trimmer videoId={probe.videoId} duration={probe.duration} start={startSec ?? 0} length={fmt === "image" ? 1 : dur}
                onStart={(v) => setStartAt(fmtClock(v))} aspect={aspect} framing={framing} video={video} />
            )}
            <SubLabel>{probe.videoId ? "O escribe dónde empieza (mm:ss)" : "Empieza en (mm:ss o h:mm:ss)"}</SubLabel>
            <input className="input max-w-[200px] text-lg font-bold tabular-nums" inputMode="numeric" value={startAt} onChange={(e) => setStartAt(e.target.value)} aria-invalid={badStart} />
            <p className={`text-sm ${badStart ? "text-red-400" : "text-zinc-400"}`}>
              {startSec === null ? "Formato no válido. Ejemplo: 1:25" : startSec >= probe.duration ? "Esa posición está fuera del vídeo." : `El vídeo dura ${fmtClock(probe.duration)}.`}
            </p>
          </> : <>
            <SubLabel>Empezar desde</SubLabel>
            <Row>{STARTS.map((o) => <Chip key={o.s} on={start === o.s} disabled={o.s > maxStart} onClick={() => setStart(o.s)}>{o.l}</Chip>)}</Row>
            <p className="text-sm text-zinc-400">{probe.dvrSeconds > 0 ? `Puedes retroceder hasta ${Math.round(probe.dvrSeconds / 3600)} h.` : "Este directo no guarda historial: se grabará desde ahora."}</p>
          </>}
          {fmt !== "image" && <>
            <div className="flex items-end justify-between pt-2"><SubLabel>{auto ? "Duración de cada clip" : "Duración del clip"}</SubLabel>
              <p className="text-2xl font-extrabold tabular-nums">{dur >= 60 ? `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, "0")} min` : `${dur} s`}</p></div>
            <input type="range" className="w-full accent-orange-500" min={Math.min(5, Math.max(1, maxDur))} max={Math.max(1, maxDur)} step={1} value={dur} onChange={(e) => setDuration(+e.target.value)} aria-label="Duración" />
          </>}
        </Section>

        {video && <Section title="Calidad">
          <Row>{QUALITIES.map((q) => <Chip key={q} on={quality === q} disabled={q > P.maxQuality || q > (probe.maxHeight || 1080)} onClick={() => setQuality(q)}>{q}p</Chip>)}</Row>
          {P.maxQuality < 1080 && <p className="text-xs text-zinc-500">Tu plan llega hasta {P.maxQuality}p. <Link href="/planes" className="text-accent hover:underline">Mejorar</Link></p>}
        </Section>}
      </div>

      {/* Resumen */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          {probe.thumbnail && <img src={probe.thumbnail} alt="" className="aspect-video w-full object-cover" />}
          <div className="space-y-4 p-4">
            <div>
              <div className="flex flex-wrap gap-1.5">
                <span className="badge">{PLATFORM[probe.platform] ?? probe.platform}</span>
                <span className={`badge ${vod ? "" : "border-red-500/40 text-red-400"}`}>{vod ? `Vídeo · ${fmtClock(probe.duration)}` : <><LiveDot className="h-1.5 w-1.5" />En directo</>}</span>
              </div>
              <p className="mt-2 line-clamp-2 font-semibold">{probe.title}</p>
              {probe.channel && <p className="text-sm text-zinc-400">{probe.channel}</p>}
            </div>
            <ul className="space-y-1 border-t border-line pt-3 text-sm text-zinc-300">
              <li className="flex items-center gap-1.5">{auto ? <><SparklesIcon className="h-3.5 w-3.5 text-accent" />{n} {n === 1 ? "clip destacado" : "clips destacados"}</> : "1 clip"} · {fmt === "image" ? "captura" : `${dur} s`}</li>
              {video && <li>{aspect} · {quality}p · {subs ? `subtítulos «${CAPTION_STYLES.find((c) => c.id === subStyle)?.name}»` : "sin subtítulos"}</li>}
              {cropped && <li>{FRAMING_LABEL[framing]}</li>}
              {!auto && vod && startSec !== null && <li>Desde {fmtClock(startSec)} hasta {fmtClock(Math.min(probe.duration, startSec + (fmt === "image" ? 0 : dur)))}</li>}
              {fmt === "audio" && <li>Audio MP3</li>}
            </ul>
            <div className="flex items-baseline justify-between border-t border-line pt-3">
              <span className="label">Coste</span>
              <span className="text-xl font-extrabold">{isAdmin ? "Gratis · admin" : isTrial ? `${n} ${n === 1 ? "prueba" : "pruebas"}` : `${total} cr`}</span>
            </div>
            {err && <p className="rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-300" role="alert">{err}</p>}
            {cantPay && <p className="text-sm text-amber-400">{isTrial ? `Solo te quedan ${trialsLeft} pruebas.` : `Te faltan ${total - credits} créditos.`}</p>}
            <button className="btn-primary w-full text-lg" disabled={busy || badStart || cantPay} onClick={submit}>
              {busy ? "Creando…" : auto ? <><SparklesIcon />Crear {n} {n === 1 ? "clip" : "clips"}</> : "Crear clip"}
            </button>
            {!isAdmin && <p className="text-center text-xs text-zinc-500">Si algo falla, te devolvemos {isTrial ? "la prueba" : "los créditos"}.</p>}
          </div>
        </div>
      </aside>
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
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="card space-y-3"><h2 className="section-title">{title}</h2>{children}</section>
);
const SubLabel = ({ children }: { children: React.ReactNode }) => <p className="label">{children}</p>;
const Row = ({ children }: { children: React.ReactNode }) => <div className="flex flex-wrap gap-2">{children}</div>;
const Chip = ({ on, children, ...p }: any) => <button type="button" aria-pressed={on} className="chip text-left" {...p}>{children}</button>;
const ModeBtn = ({ on, title, sub, onClick }: { on: boolean; title: React.ReactNode; sub: string; onClick: () => void }) => (
  <button type="button" aria-pressed={on} onClick={onClick}
    className={`rounded-xl px-3 py-3 text-left transition ${on ? "bg-card2 ring-1 ring-accent" : "hover:bg-card2/60"}`}>
    <span className={`flex items-center gap-1.5 text-sm font-bold ${on ? "text-accent" : ""}`}>{title}</span>
    <span className="block text-xs text-zinc-400">{sub}</span>
  </button>
);
