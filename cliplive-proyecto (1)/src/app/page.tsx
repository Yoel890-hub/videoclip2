import Link from "next/link";
import { admin, requireUser } from "@/lib/supabase";
import ClipCard from "@/components/ClipCard";
import UrlForm from "@/components/UrlForm";
import { TRIALS } from "@/lib/plans";

export default async function Workspace() {
  const user = (await requireUser())!;
  const db = admin();
  const [{ data: prof }, { data: clips }] = await Promise.all([
    db.from("profiles").select("*").eq("id", user.id).single(),
    db.from("clips").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
  ]);
  const name = user.user_metadata?.name ?? user.email?.split("@")[0];
  const { count } = await db.from("clips").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  return (
    <div className="space-y-6">
      <div><h1 className="text-4xl font-extrabold">Nuevo Clip, {name}</h1>
        <p className="mt-1 text-zinc-400">Pega la URL de un directo y crea un clip en segundos.</p></div>
      <div className="grid grid-cols-3 gap-3">
        <div className="card"><p className="label">Créditos</p><p className="mt-1 text-2xl font-extrabold">{prof?.credits}</p></div>
        <div className="card"><p className="label">Pruebas</p><p className="mt-1 text-2xl font-extrabold">{Math.max(0, TRIALS - (prof?.trials_used ?? 0))}/{TRIALS}</p></div>
        <div className="card"><p className="label">Clips</p><p className="mt-1 text-2xl font-extrabold">{count ?? 0}</p></div>
      </div>
      <section className="card space-y-3"><h2 className="label">Directo objetivo</h2><UrlForm /></section>
      <section className="space-y-3">
        <div className="flex items-baseline justify-between"><h2 className="text-xl font-bold">Tus clips</h2><Link href="/clips" className="text-sm font-semibold text-accent">Ver todos</Link></div>
        {clips?.length ? clips.map((c) => <ClipCard key={c.id} c={c} />) : <p className="text-zinc-400">Aún no tienes clips.</p>}
      </section>
    </div>
  );
}
