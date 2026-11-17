import { admin, requireUser } from "@/lib/supabase";
import { PLANS, REFERRAL_BONUS, type PlanId } from "@/lib/plans";
import PlanButton from "@/components/PlanButton";

export default async function Planes() {
  const user = (await requireUser())!;
  const { data: prof } = await admin().from("profiles").select("plan,referral_code").eq("id", user.id).single();
  return (
    <div className="space-y-4">
      <h1 className="text-4xl font-extrabold">Mejora tu plan</h1>
      {(["starter", "creator", "pro"] as PlanId[]).map((id) => { const p = PLANS[id]; return (
        <section key={id} className={`card space-y-2 ${id === "creator" ? "border-accent" : ""}`}>
          <div className="flex items-baseline justify-between"><h2 className="text-2xl font-extrabold">{p.name}</h2><p><b className="text-2xl">{p.price} €</b>/mes</p></div>
          <ul className="text-sm text-zinc-300"><li>{p.credits} créditos al mes</li><li>Hasta {p.maxQuality}p</li><li>Clips de hasta {Math.round(p.maxDuration / 60)} min</li>
            <li>Retroceder hasta {p.rewindMin >= 60 ? `${p.rewindMin / 60} h` : `${p.rewindMin} min`}</li><li>{p.concurrent} clips simultáneos</li></ul>
          <PlanButton plan={id} current={prof?.plan === id} />
        </section>); })}
      <section className="card border-dashed border-accent/50">
        <h2 className="text-xl font-bold">Invita a un amigo y te damos {REFERRAL_BONUS} créditos</h2>
        <p className="mt-1 text-sm text-zinc-400">Tu código: <b className="select-all tracking-widest">{prof?.referral_code}</b></p>
      </section>
    </div>
  );
}
