import { admin, requireUser } from "@/lib/supabase";
import ClipCard from "@/components/ClipCard";
import AutoRefresh from "@/components/AutoRefresh";
export const dynamic = "force-dynamic";
export default async function Clips() {
  const user = (await requireUser())!;
  const { data } = await admin().from("clips").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  const busy = !!data?.some((c) => c.status === "queued" || c.status === "processing");
  return (
    <div className="space-y-4"><h1 className="text-4xl font-extrabold">Tus clips</h1>
      <AutoRefresh active={busy} />
      {data?.length ? data.map((c) => <ClipCard key={c.id} c={c} />) : <p className="text-zinc-400">Aún no tienes clips.</p>}</div>
  );
}
