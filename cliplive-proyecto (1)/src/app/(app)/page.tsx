import Link from "next/link";
import { admin, requireUser, getProfile } from "@/lib/supabase";
import ClipCard from "@/components/ClipCard";
import UrlForm from "@/components/UrlForm";
import AutoRefresh from "@/components/AutoRefresh";
import { TRIALS } from "@/lib/plans";
import { ArrowRightIcon } from "@/components/Icons";
import { isAdmin } from "@/lib/admin";
import { displayName } from "@/lib/users";
export const dynamic = "force-dynamic";

export default async function Workspace() {
  const user = (await requireUser())!;
  const db = admin();
  const [{ data: prof }, { data: clips }, { count }] = await Promise.all([
    getProfile(user.id).then((data) => ({ data })),
    db.from("clips").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
    db.from("clips").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  const adm = isAdmin(user);
  const name = user.user_metadata?.name ?? displayName(user.email).split("@")[0];
  const busy = !!clips?.some((c) => c.status === "queued" || c.status === "processing");
  const trial = !adm && prof?.plan === "trial";

  return (
    <div className="space-y-8">
      <AutoRefresh active={busy} />
      <section className="glow overflow-hidden rounded-3xl border border-line p-5 sm:p-8">
        <p className="label text-accent">Hola, {name}</p>
        <h1 className="mt-2 max-w-2xl text-[1.75rem] font-extrabold leading-tight sm:text-5xl">
          Convierte cualquier directo o vídeo en <span className="text-accent">clips listos para redes</span>
        </h1>
        <p className="mt-3 max-w-xl text-zinc-400">Pega el enlace, elige el momento (o deja que busquemos los mejores) y descarga en vertical, con o sin subtítulos.</p>
        <div className="mt-6 max-w-2xl"><UrlForm /></div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-400">
          {["YouTube", "Twitch", "Kick", "TikTok"].map((p) => <span key={p} className="badge normal-case">{p}</span>)}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label={adm ? "Clips" : trial ? "Pruebas gratis" : "Créditos"} short={adm ? "∞" : undefined} value={adm ? "Ilimitados" : trial ? `${Math.max(0, TRIALS - (prof?.trials_used ?? 0))}/${TRIALS}` : String(prof?.credits ?? 0)} />
        <Stat label="Creados" value={String(count ?? 0)} />
        <Stat label="Plan" value={adm ? "Admin" : prof?.plan === "trial" ? "Prueba" : String(prof?.plan ?? "")} capitalize />
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold">Últimos clips</h2>
          <Link href="/clips" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">Ver todos <ArrowRightIcon /></Link>
        </div>
        {clips?.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{clips.map((c) => <ClipCard key={c.id} c={c} />)}</div>
        ) : <p className="card text-zinc-400">Aún no tienes clips. Pega un enlace arriba para empezar.</p>}
      </section>
    </div>
  );
}

// En móvil las tres tarjetas son estrechas: texto más pequeño y que nunca se salga.
const Stat = ({ label, value, short, capitalize }: { label: string; value: string; short?: string; capitalize?: boolean }) => (
  <div className="min-w-0 rounded-2xl border border-line bg-card p-3 sm:p-4">
    <p className="label text-[10px] leading-tight sm:text-[11px]">{label}</p>
    <p className={`mt-1 truncate text-xl font-extrabold leading-tight sm:text-3xl ${capitalize ? "capitalize" : ""}`} title={value}>
      {short ? <><span className="sm:hidden">{short}</span><span className="hidden sm:inline">{value}</span></> : value}
    </p>
  </div>
);
