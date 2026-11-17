const STATUS: Record<string, string> = { queued: "En cola", processing: "Procesando", ready: "Listo", error: "Error" };
const FMT: Record<string, string> = { video: "Video MP4", audio: "Audio MP3", image: "Captura JPG" };

export default function ClipCard({ c }: { c: any }) {
  const ready = c.status === "ready";
  return (
    <article className="card space-y-3">
      <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        <span>{c.platform}</span><span>{c.source_kind === "vod" ? "Vídeo" : "Directo"}</span><span>{FMT[c.format]}</span>
        {c.format === "video" && <><span>{c.aspect}</span><span className="normal-case">{c.quality}p</span></>}
        <span>{c.duration_s}s</span>{c.source_kind === "vod" && <span>desde {Math.floor(c.start_at_s / 60)}:{String(c.start_at_s % 60).padStart(2, "0")}</span>}
      </div>
      <p className="font-semibold">{c.title ?? c.source_url}</p>
      <p className={ready ? "text-green-400" : c.status === "error" ? "text-red-400" : "text-zinc-300"}>
        {STATUS[c.status]}{c.status === "error" && c.error ? ` · ${c.error} (créditos devueltos)` : ""}
        {ready && c.size_bytes ? ` · ${(c.size_bytes / 1048576).toFixed(1)} MB` : ""}
      </p>
      {ready && c.expires_at && <p className="text-sm text-zinc-400">Disponible hasta {new Date(c.expires_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</p>}
      {ready && <a className="btn-primary w-full" href={`/api/clips/${c.id}/download`}>Descargar</a>}
    </article>
  );
}
