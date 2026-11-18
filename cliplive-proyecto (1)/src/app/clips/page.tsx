import Link from "next/link";
import { admin, requireUser } from "@/lib/supabase";
import ClipCard from "@/components/ClipCard";
import AutoRefresh from "@/components/AutoRefresh";
import { AlertIcon, FilmIcon, SparklesIcon } from "@/components/Icons";
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

      {running.map((a) => (
        <article key={a.id} className="glow flex items-center gap-4 rounded-2xl border border-accent/40 p-4">
          <span className="h-8 w-8 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-accent" aria-hidden />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-semibold"><SparklesIcon className="h-4 w-4 text-accent" />Buscando los momentos destacados…</p>
            <p className="truncate text-sm text-zinc-400">
              {a.count} {a.count === 1 ? "clip" : "clips"} de {a.duration_s}s{a.subtitles ? " con subtítulos" : ""}
              {a.source_kind === "live" && a.status === "analyzing" ? ` · grabando ${a.window_s / 60} min del directo` : ""} · {a.source_url}
            </p>
          </div>
        </article>
      ))}
      {lastErr && <p className="flex items-center gap-2 rounded-2xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-300"><AlertIcon className="h-4 w-4" />Momentos destacados: {lastErr.error}</p>}

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
