"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PLANS, QUALITIES, AUTO_WINDOWS, RECORD_WINDOWS, clipCost, isTikTokLive, isYoutubeLive, suggestedClips, type PlanId } from "@/lib/plans";
import Trimmer from "@/components/Trimmer";
import CaptionPicker from "@/components/CaptionPicker";
import { CAPTION_STYLES, SUB_SIZES, SUB_POSITIONS, SUB_LANGS } from "@/lib/captionStyles";
import { SparklesIcon, VideoIcon, HeadphonesIcon, ImageIcon, LiveDot } from "@/components/Icons";
import { ORIGINAL_MAX_BYTES, ORIGINAL_MAX_MB } from "@/lib/original-file";

const STARTS = [{ l: "En vivo", s: 0 }, { l: "1m", s: 60 }, { l: "2m", s: 120 }, { l: "5m", s: 300 }, { l: "10m", s: 600 }, { l: "30m", s: 1800 }, { l: "60m", s: 3600 }, { l: "120m", s: 7200 }];
const FORMATS = [{ v: "video", l: "Vídeo", I: VideoIcon }, { v: "audio", l: "Audio", I: HeadphonesIcon }, { v: "image", l: "Captura", I: ImageIcon }];
const FRAMING_OPTS = [["auto", "Automático", "Sigue las caras"], ["left", "Izquierda", ""], ["center", "Centro", ""], ["right", "Derecha", ""]];
const FRAMING_LABEL: Record<string, string> = { auto: "encuadre automático", left: "encuadre izquierda", center: "encuadre centro", right: "encuadre derecha" };
const PLATFORM: Record<string, string> = { youtube: "YouTube", twitch: "Twitch", kick: "Kick", tiktok: "TikTok", file: "Archivo original" };

export default function ClipConfig({ plan, credits, trialsLeft, isAdmin = false, fromFile = false }: { plan: PlanId; credits: number; trialsLeft: number; isAdmin?: boolean; fromFile?: boolean }) {
  // Admin: límites del plan Pro, gratis e ilimitado.
  const P = isAdmin ? PLANS.premium : PLANS[plan], router = useRouter();
  const [probe, setProbe] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [count, setCount] = useState(3), [win, setWin] = useState(120);
  const [format, setFormat] = useState("video"), [aspect, setAspect] = useState("9:16"), [subStyle, setSubStyle] = useState<string | null>(null), [subSize, setSubSize] = useState("m"), [subPos, setSubPos] = useState("auto"), [subLang, setSubLang] = useState("original"), [framing, setFraming] = useState("auto");
  const [start, setStart] = useState(0), [duration, setDuration] = useState(30), [quality, setQuality] = useState(480);
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false), [startAt, setStartAt] = useState("0:00");
  useEffect(() => {
    if (fromFile) return;
    try {
      const p = JSON.parse(sessionStorage.getItem("probe") ?? "null");
      setProbe(p);
      if (p && isTikTokLive(p)) {
        // TikTok no guarda los directos: lo normal es grabar y sacar clips de la grabación.
        const w = RECORD_WINDOWS.filter((x) => x <= P.recordMin * 60).slice(-1)[0] ?? RECORD_WINDOWS[0];
        const first = Math.min(1800, w);   // 30 min por defecto (o lo máximo del plan si es menos)
        setMode("auto"); setWin(first); setCount(suggestedClips(first, P.recordClips));
      } else if (p && isYoutubeLive(p)) {
        // YouTube: por defecto se analizan los últimos 30 min ya emitidos (o lo que guarde / permita el plan).
        const ok = RECORD_WINDOWS.filter((x) => x <= P.recordMin * 60 && x <= (p.dvrSeconds ?? 0) + 120);
        const first = Math.min(1800, ok.slice(-1)[0] ?? RECORD_WINDOWS[0]);
        setWin(first); setCount(suggestedClips(first, P.recordClips));
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const picker = fromFile && <section className="card space-y-3">
    <label className="block font-semibold" htmlFor="original">Selecciona tu vídeo original</label>
    <p className="text-sm text-zinc-400">MP4 o MOV de hasta {ORIGINAL_MAX_MB} MB. Puedes usar una grabación del tramo que quieres recortar.</p>
    <input id="original" type="file" accept=".mp4,.mov,.m4v,video/mp4,video/quicktime" disabled={busy}
      onChange={e => {
        const selected = e.target.files?.[0];
        setProbe(null); setErr(""); setStartAt("0:00");
        if (selected && selected.size > ORIGINAL_MAX_BYTES) setErr(`El archivo supera los ${ORIGINAL_MAX_MB} MB.`);
        setFile(selected && selected.size <= ORIGINAL_MAX_BYTES ? selected : null);
      }} />
    {preview && file && <video key={preview} src={preview} controls playsInline preload="metadata" className="max-h-56 w-full bg-black"
      onLoadedMetadata={e => {
        const v = e.currentTarget;
        if (!v.videoWidth || !Number.isFinite(v.duration) || v.duration < 1) { setErr("Este archivo no contiene un vídeo que se pueda recortar."); return; }
        setProbe({ kind: "vod", platform: "file", title: file.name, duration: Math.floor(v.duration), maxHeight: v.videoHeight });
      }} onError={() => { setProbe(null); setErr("El navegador no pudo abrir este vídeo. Prueba con un MP4 compatible."); }} />}
  </section>;
  if (!probe && fromFile) return <div className="space-y-3">{picker}{err && <p role="alert" className="text-red-400">{err}</p>}</div>;
  if (!probe) return (
    <div className="card flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-zinc-400">Primero pega el enlace de un directo o vídeo.</p>
      <Link href="/" className="btn-primary">Ir a crear</Link>
    </div>
  );

  const isTrial = !isAdmin && plan === "trial", auto = mode === "auto", vod = probe.kind === "vod";
  const ttRec = isTikTokLive(probe);   // directo de TikTok → se graba
  const ytLive = isYoutubeLive(probe);  // directo de YouTube → se analiza lo ya emitido
  const longLive = ttRec || ytLive;     // grabaciones/análisis largos (hasta 3 h según el plan)
  const fmtDvr = (s: number) => (s >= 3600 ? `${(s / 3600).toFixed(s % 3600 < 300 ? 0 : 1)} h` : `${Math.max(1, Math.round(s / 60))} min`);
  const winLabel = (w: number) => (w >= 3600 ? `${w / 3600} h` : `${w / 60} min`);
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
  const maxCount = longLive && auto
    ? Math.max(1, Math.min(P.recordClips, isTrial ? trialsLeft : 30))
    : isTrial ? Math.max(1, Math.min(5, trialsLeft)) : 5;
  const n = auto ? Math.min(count, maxCount) : 1;
  const total = perClip * n;
  const badStart = !auto && vod && (startSec === null || startSec >= probe.duration);
  const cantPay = isAdmin ? false : isTrial ? trialsLeft < n : total > credits;

  const submit = async () => {
    setBusy(true); setErr("");
    const body = auto
      ? { url: probe.url, kind: probe.kind, format: fmt, aspect, quality, duration: dur, count: n, window: win, subtitles: video && subs, subtitleStyle: subStyle, subtitleSize: subSize, subtitlePosition: subPos, subtitleLang: subLang, framing }
      : { url: probe.url, format: fmt, aspect, kind: probe.kind, startOffset: start, startAt: startSec, duration: dur, quality, subtitles: video && subs, subtitleStyle: subStyle, subtitleSize: subSize, subtitlePosition: subPos, subtitleLang: subLang, framing };
    try {
      const r = await fetch(auto ? "/api/auto" : "/api/clips", file
        ? { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Clip-Options": JSON.stringify(body) }, body: file }
        : { method: "POST", body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) return setErr(j.error);
      router.push("/clips"); router.refresh();
    } catch { setErr("Se interrumpió el envío. Revisa Mis clips antes de intentarlo de nuevo."); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        {/* Modo */}
        {fromFile ? picker : <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-card p-1">
          <ModeBtn on={!auto} onClick={() => setMode("manual")} title="Elegir yo el momento" sub="Tú marcas dónde empieza" />
          <ModeBtn on={auto} onClick={() => setMode("auto")}
            title={ttRec ? <><LiveDot className="h-2 w-2" />Grabar directo</> : ytLive ? <><SparklesIcon className="h-4 w-4" />Analizar directo</> : <><SparklesIcon className="h-4 w-4" />Momentos destacados</>}
            sub={ttRec ? "Grabamos y sacamos los mejores clips" : ytLive ? "Lo mejor de lo ya emitido, al momento" : "Buscamos los mejores por ti"} />
        </div>}
        {auto && (
          <p className="rounded-2xl border border-accent/30 bg-accent/5 p-4 text-sm text-zinc-300">
            {vod ? "Analizamos el audio del vídeo (y lo más visto en YouTube, si está disponible) para encontrar los momentos con más intensidad, y creamos clips al azar entre los mejores."
              : ytLive
                ? `YouTube guarda ${fmtDvr(probe.dvrSeconds)} de este directo. Analizamos los últimos ${winLabel(Math.min(win, probe.dvrSeconds))} (lo que ya se emitió), buscamos los momentos con más intensidad y sacamos ${n} ${n === 1 ? "clip" : "clips"}. No hay que esperar a que pase el tiempo.`
              : ttRec
                ? `TikTok no guarda los directos, así que lo grabamos desde ahora durante ${winLabel(win)}. Al terminar, buscamos los momentos con más intensidad (gritos, risas, aplausos…) y sacamos ${n} ${n === 1 ? "clip" : "clips"}. Si el directo acaba antes, usamos lo grabado hasta ese momento.`
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
            {longLive ? <>
              <SubLabel>{ytLive ? "¿Cuánto del directo analizamos?" : "¿Cuánto tiempo grabamos?"}</SubLabel>
              <Row>{RECORD_WINDOWS.map((w) => {
                const tooLong = ytLive && w > probe.dvrSeconds + 120;   // más de lo que guarda YouTube
                const locked = w > P.recordMin * 60 || tooLong;
                return <Chip key={w} on={win === w} disabled={locked} title={tooLong ? "YouTube no guarda tanto de este directo" : locked ? "Disponible en planes superiores" : undefined}
                  onClick={() => { setWin(w); setCount(suggestedClips(w, maxCount)); }}>{winLabel(w)}</Chip>;
              })}</Row>
              {P.recordMin < 180 && <p className="text-xs text-zinc-500">Tu plan {ytLive ? "analiza" : "graba"} hasta {winLabel(P.recordMin * 60)}. <Link href="/planes" className="text-accent hover:underline">{ytLive ? "Analizar" : "Grabar"} más tiempo</Link></p>}
              <div className="flex items-end justify-between pt-2"><SubLabel>¿Cuántos clips sacamos?</SubLabel><p className="text-2xl font-extrabold tabular-nums">{n}</p></div>
              <input type="range" className="w-full accent-orange-500" min={1} max={maxCount} step={1} value={n} onChange={(e) => setCount(+e.target.value)} aria-label="Número de clips" disabled={maxCount <= 1} />
              <p className="text-xs text-zinc-500">Te sugerimos {suggestedClips(win, maxCount)} (uno cada ~5 min de directo). Máximo {maxCount} con tu plan.</p>
            </> : <>
              <SubLabel>¿Cuántos clips?</SubLabel>
              <Row>{[1, 2, 3, 4, 5].map((k) => <Chip key={k} on={n === k} disabled={k > maxCount} onClick={() => setCount(k)}>{k}</Chip>)}</Row>
              {!vod && <><SubLabel>Tiempo de directo a analizar</SubLabel>
                <Row>{AUTO_WINDOWS.map((w) => <Chip key={w} on={win === w} disabled={isTrial && w > 120} onClick={() => setWin(w)}>{w / 60} min</Chip>)}</Row></>}
            </>}
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
            <p className="text-sm text-zinc-400">{probe.dvrSeconds > 0 ? `Puedes retroceder hasta ${fmtDvr(probe.dvrSeconds)}${probe.platform === "youtube" ? " (lo que guarda YouTube de este directo)" : ""}.` : "Este directo no guarda historial: se grabará desde ahora."}</p>
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
              {busy ? "Creando…" : auto && ttRec ? <><LiveDot className="h-2 w-2" />Grabar {winLabel(win)} y sacar {n} {n === 1 ? "clip" : "clips"}</> : auto && ytLive ? <><SparklesIcon />Analizar {winLabel(Math.min(win, probe.dvrSeconds))} y sacar {n} {n === 1 ? "clip" : "clips"}</> : auto ? <><SparklesIcon />Crear {n} {n === 1 ? "clip" : "clips"}</> : "Crear clip"}
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
