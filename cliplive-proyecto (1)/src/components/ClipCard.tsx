import { AlertIcon, CaptionsIcon, DownloadIcon, HeadphonesIcon, SparklesIcon } from "@/components/Icons";
import ClipActions from "@/components/ClipActions";

const FMT: Record<string, string> = { video: "Vídeo", audio: "Audio MP3", image: "Captura" };
const PLATFORM: Record<string, string> = { youtube: "YouTube", twitch: "Twitch", kick: "Kick", tiktok: "TikTok" };

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Tarjeta de un clip, con vista previa cuando está listo.
export default function ClipCard({ c }: { c: any }) {
  const ready = c.status === "ready", working = c.status === "queued" || c.status === "processing";
  const view = `/api/clips/${c.id}/view`;
  const tall = c.format === "video" && c.aspect === "9:16", square = c.format === "video" && c.aspect === "1:1";
  const frame = tall ? "aspect-[9/16] max-h-[420px] mx-auto" : square ? "aspect-square" : "aspect-video";

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-card transition hover:border-zinc-600">
      {/* Vista previa */}
      <div className="bg-black">
        {ready && c.format === "video" && (
          <video className={`block w-full ${frame} bg-black object-contain`} src={view} controls playsInline preload="metadata" />
        )}
        {ready && c.format === "image" && <img className="block aspect-video w-full object-contain" src={view} alt="Captura del clip" />}
        {ready && c.format === "audio" && (
          <div className="flex aspect-video flex-col items-center justify-center gap-4 bg-gradient-to-br from-accent/20 to-transparent p-4">
            <HeadphonesIcon className="h-10 w-10 text-accent" />
            <audio className="w-full" src={view} controls preload="metadata" />
          </div>
        )}
        {working && (
          <div className={`flex ${tall ? "aspect-video" : frame} w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-card2 to-black px-6`}>
            {c.status === "queued" ? (
              <>
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-accent" aria-hidden />
                <p className="text-sm font-semibold text-zinc-300">En cola…</p>
              </>
            ) : (
              <>
                <p className="text-3xl font-extrabold tabular-nums">{Math.max(1, c.progress ?? 0)}%</p>
                <div className="h-2 w-full max-w-[240px] overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.progress ?? 0} aria-label="Progreso del clip">
                  <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${Math.max(2, c.progress ?? 0)}%` }} />
                </div>
                <p className="text-sm font-semibold text-zinc-300">{c.stage ?? "Preparando…"}</p>
              </>
            )}
          </div>
        )}
        {c.status === "error" && (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-red-950/30 p-4 text-center">
            <AlertIcon className="h-7 w-7 text-red-400" />
            <p className="text-sm font-semibold text-red-300">{c.error ?? "No se pudo crear el clip"}</p>
            <p className="text-xs text-zinc-400">{c.is_trial ? "Se te ha devuelto la prueba." : "Se te han devuelto los créditos."}</p>
          </div>
        )}
      </div>

      {/* Datos */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          {c.auto_job_id && <span className="badge border-accent/40 text-accent"><SparklesIcon className="h-3 w-3" />Destacado</span>}
          <span className="badge">{PLATFORM[c.platform] ?? c.platform}</span>
          <span className="badge">{FMT[c.format]}</span>
          {c.format === "video" && <><span className="badge">{c.aspect}</span><span className="badge normal-case">{c.quality}p</span></>}
          {c.subtitles && <span className="badge"><CaptionsIcon className="h-3 w-3" />Subtítulos</span>}
          <span className="badge normal-case">{c.duration_s}s</span>
          {c.source_kind === "vod" && c.start_at_s != null && <span className="badge normal-case">desde {clock(c.start_at_s)}</span>}
        </div>
        <ClipActions id={c.id} title={c.title ?? c.source_url} canDelete={!working} />
        {ready && (
          <div className="mt-auto space-y-2">
            <a className="btn-primary w-full" href={`/api/clips/${c.id}/download`}><DownloadIcon />Descargar{c.size_bytes ? ` · ${(c.size_bytes / 1048576).toFixed(1)} MB` : ""}</a>
            {c.expires_at && <p className="text-center text-xs text-zinc-500">Disponible hasta el {new Date(c.expires_at).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}</p>}
          </div>
        )}
      </div>
    </article>
  );
}
