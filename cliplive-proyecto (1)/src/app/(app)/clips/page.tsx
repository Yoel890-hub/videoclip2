import Link from "next/link";
import { admin, requireUser } from "@/lib/supabase";
import ClipCard from "@/components/ClipCard";
import YouTubeClipLink from "@/components/YouTubeClipLink";
import AutoRefresh from "@/components/AutoRefresh";
import { AlertIcon, FilmIcon, LiveDot, SparklesIcon } from "@/components/Icons";
export const dynamic = "force-dynamic";

export default async function Clips() {
  const user = (await requireUser())!;
  const db = admin();
  const [{ data }, { data: autos }] = await Promise.all([
    db.from("clips").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    db.from("auto_jobs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
  ]);
  const running = (autos ?? []).filter((a) => a.status === "queued" || a.status === "analyzing");
  // Mostrar el error de la última búsqueda solo si es reciente (últimos 10 min).
  const lastErr = (autos ?? []).find((a) => a.status === "error" && Date.now() - new Date(a.created_at).getTime() < 600_000);
  const busy = running.length > 0 || !!data?.some((c) => c.status === "queued" || c.status === "processing");
  const ready = data?.filter((c) => c.status === "ready").length ?? 0;

  return (
    <div className="space-y-6">
      <AutoRefresh active={busy} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">Tus clips</h1>
          <p className="mt-1 text-zinc-400">{data?.length ? `${ready} listos de ${data.length}` : "Aquí aparecerán tus clips."}{busy && " · Actualizando…"}</p>
        </div>
        <Link href="/" className="btn-primary">+ Nuevo clip</Link>
      </div>

      {running.map((a) => {
        // Grabación en curso: minutos grabados sobre el total (se actualiza con el refresco automático).
        const rec = a.recording_started_at ? Math.min(a.window_s, Math.max(0, (Date.now() - new Date(a.recording_started_at).getTime()) / 1000)) : null;
        const fmtMin = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} min` : `${Math.floor(s / 60)} min`);
        const tiktok = a.platform === "tiktok" && a.source_kind === "live";
        const title = a.status === "queued" ? "En cola…"
          : rec != null ? `Grabando el directo · ${fmtMin(rec)} de ${fmtMin(a.window_s)}`
          : a.stage ? `${a.stage} · ${a.progress ?? 0}%`
          : tiktok ? "Buscando los mejores momentos de la grabación…" : "Buscando los momentos destacados…";
        const analyzing = rec == null && a.status === "analyzing" && (a.progress ?? 0) > 0;
        return (
          <article key={a.id} className="glow space-y-3 rounded-2xl border border-accent/40 p-4">
            <div className="flex items-center gap-4">
              {rec != null
                ? <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-500/15"><LiveDot className="h-2.5 w-2.5" /></span>
                : <span className="h-8 w-8 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-accent" aria-hidden />}
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-semibold">{rec == null && <SparklesIcon className="h-4 w-4 text-accent" />}{title}</p>
                <p className="truncate text-sm text-zinc-400">
                  {a.count} {a.count === 1 ? "clip" : "clips"} de {a.duration_s}s{a.subtitles ? " con subtítulos" : ""} · {a.source_url}
                </p>
              </div>
            </div>
            {analyzing && (
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={a.progress} aria-label="Progreso del análisis">
                <div className="h-full rounded-full bg-accent transition-[width] duration-1000" style={{ width: `${Math.max(2, a.progress)}%` }} />
              </div>
            )}
            {analyzing && a.progress < 80 && <p className="text-xs text-zinc-500">Los vídeos muy largos tardan más: hay que escuchar todo el audio para encontrar los mejores momentos. Puedes cerrar la página.</p>}
            {rec != null && (
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-valuemin={0} aria-valuemax={a.window_s} aria-valuenow={Math.round(rec)} aria-label="Progreso de la grabación">
                <div className="h-full rounded-full bg-accent transition-[width] duration-1000" style={{ width: `${Math.max(1, (rec / a.window_s) * 100)}%` }} />
              </div>
            )}
            {rec != null && <p className="text-xs text-zinc-500">Puedes cerrar la página: la grabación sigue y los clips aparecerán aquí al terminar.</p>}
          </article>
        );
      })}
      {lastErr && <div className="space-y-2 rounded-2xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-300">
        <p className="flex items-center gap-2"><AlertIcon className="h-4 w-4" />Momentos destacados: {lastErr.error}</p>
        {lastErr.platform === "youtube" && <YouTubeClipLink url={lastErr.source_url} />}
      </div>}

      {data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => <ClipCard key={c.id} c={c} />)}
        </div>
      ) : !running.length && (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <FilmIcon className="h-10 w-10 text-zinc-500" />
          <p className="font-semibold">Aún no tienes clips</p>
          <Link href="/" className="btn-primary">Crear el primero</Link>
        </div>
      )}
    </div>
  );
}
