"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Reproductor de YouTube + barra de tiempo para elegir dónde empieza el clip.
// Muestra el encuadre vertical/cuadrado encima del vídeo para ver qué parte saldrá.

declare global { interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void } }

let apiPromise: Promise<any> | null = null;
function loadYouTubeApi(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) apiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return apiPromise;
}

export const clock = (s: number) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`;
};

type Props = {
  videoId: string; duration: number; start: number; length: number;
  onStart: (s: number) => void; aspect: string; framing: string; video: boolean;
};

export default function Trimmer({ videoId, duration, start, length, onStart, aspect, framing, video }: Props) {
  const host = useRef<HTMLDivElement>(null), player = useRef<any>(null), bar = useRef<HTMLDivElement>(null);
  const stopAt = useRef<number | null>(null);
  const [now, setNow] = useState(0), [ready, setReady] = useState(false), [failed, setFailed] = useState(false), [playing, setPlaying] = useState(false);
  const end = Math.min(duration, start + length);

  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !host.current) return;
      player.current = new YT.Player(host.current, {
        videoId, width: "100%", height: "100%",
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, start: Math.floor(start) },
        events: {
          onReady: () => setReady(true),
          onError: () => setFailed(true),
          onStateChange: (e: any) => setPlaying(e.data === 1),
        },
      });
    });
    const t = setInterval(() => {
      const p = player.current;
      if (!p?.getCurrentTime) return;
      const cur = p.getCurrentTime();
      setNow(cur);
      if (stopAt.current != null && cur >= stopAt.current) { p.pauseVideo(); stopAt.current = null; }
    }, 200);
    return () => { cancelled = true; clearInterval(t); player.current?.destroy?.(); player.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const seek = useCallback((s: number) => { player.current?.seekTo?.(s, true); setNow(s); }, []);
  const setStartAndSeek = (s: number) => {
    const v = Math.max(0, Math.min(Math.floor(s), Math.max(0, duration - 1)));
    onStart(v); seek(v);
  };
  const previewSelection = () => { seek(start); stopAt.current = end; player.current?.playVideo?.(); };

  // Clic o arrastre en la barra → mueve el inicio (centrando la selección donde se pulsa).
  const fromPointer = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    setStartAndSeek(frac * duration - length / 2);
  };
  const dragging = useRef(false);

  // Zona que se verá en vertical/cuadrado (solo si el encuadre es fijo).
  const cropW = aspect === "9:16" ? (9 / 16) / (16 / 9) : aspect === "1:1" ? 9 / 16 : 1;   // fracción del ancho de un vídeo 16:9
  const cropLeft = framing === "left" ? 0 : framing === "right" ? 1 - cropW : (1 - cropW) / 2;
  const showCrop = video && cropW < 1;

  const pct = (s: number) => `${(s / Math.max(1, duration)) * 100}%`;

  return (
    <div className="space-y-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        <div ref={host} className="absolute inset-0 h-full w-full" />
        {showCrop && ready && !failed && (framing === "auto" ? (
          <span className="pointer-events-none absolute left-2 top-2 rounded-lg bg-black/70 px-2 py-1 text-xs font-semibold text-zinc-200">Encuadre automático: sigue las caras</span>
        ) : (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-y-0 left-0 bg-black/60" style={{ width: `${cropLeft * 100}%` }} />
            <div className="absolute inset-y-0 border-2 border-accent" style={{ left: `${cropLeft * 100}%`, width: `${cropW * 100}%` }} />
            <div className="absolute inset-y-0 right-0 bg-black/60" style={{ width: `${(1 - cropLeft - cropW) * 100}%` }} />
          </div>
        ))}
        {failed && (
          <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-zinc-300">
            Este vídeo no se puede reproducir aquí (el canal no permite insertarlo). Escribe el minuto de inicio a mano.
          </div>
        )}
      </div>

      {/* Barra de tiempo */}
      <div>
        <div ref={bar} role="slider" tabIndex={0} aria-label="Inicio del clip" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={start} aria-valuetext={clock(start)}
          className="relative h-10 cursor-pointer touch-none select-none rounded-lg border border-line bg-card2"
          onPointerDown={(e) => { dragging.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); fromPointer(e.clientX); }}
          onPointerMove={(e) => { if (dragging.current) fromPointer(e.clientX); }}
          onPointerUp={() => { dragging.current = false; }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") { e.preventDefault(); setStartAndSeek(start - (e.shiftKey ? 10 : 1)); }
            if (e.key === "ArrowRight") { e.preventDefault(); setStartAndSeek(start + (e.shiftKey ? 10 : 1)); }
          }}>
          <div className="absolute inset-y-1 rounded-md border-2 border-accent bg-accent/25" style={{ left: pct(start), width: `max(6px, ${pct(end - start)})` }} />
          <div className="absolute inset-y-0 w-0.5 bg-white" style={{ left: pct(now) }} aria-hidden />
        </div>
        <div className="mt-1 flex justify-between text-xs tabular-nums text-zinc-500"><span>0:00</span><span>{clock(duration)}</span></div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="chip" onClick={() => setStartAndSeek(start - 5)}>−5 s</button>
        <button type="button" className="chip" onClick={() => setStartAndSeek(start - 1)}>−1 s</button>
        <span className="min-w-[110px] text-center text-sm font-bold tabular-nums">{clock(start)} → {clock(end)}</span>
        <button type="button" className="chip" onClick={() => setStartAndSeek(start + 1)}>+1 s</button>
        <button type="button" className="chip" onClick={() => setStartAndSeek(start + 5)}>+5 s</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-ghost text-sm" disabled={!ready || failed} onClick={() => setStartAndSeek(now)}>Empezar aquí ({clock(now)})</button>
        <button type="button" className="btn-ghost text-sm" disabled={!ready || failed} onClick={() => (playing && stopAt.current != null ? player.current?.pauseVideo() : previewSelection())}>
          {playing && stopAt.current != null ? "Pausar" : "Ver selección"}
        </button>
      </div>
    </div>
  );
}
