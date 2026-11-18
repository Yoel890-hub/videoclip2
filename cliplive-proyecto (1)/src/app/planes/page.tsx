import { admin, requireUser } from "@/lib/supabase";
import { PLANS, PAID_PLANS, REFERRAL_BONUS } from "@/lib/plans";
import PlanButton from "@/components/PlanButton";
import PlanCard from "@/components/PlanCard";

const BADGE: Record<string, string> = { creator: "El más elegido", premium: "Mejor precio" };

export default async function Planes() {
  const user = (await requireUser())!;
  const { data: prof } = await admin().from("profiles").select("plan,referral_code").eq("id", user.id).single();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Mejora tu plan</h1>
        <p className="mt-1 text-zinc-400">Precios en dólares. Cancela cuando quieras.</p>
      </div>
      <div className="grid gap-5 pt-4 sm:grid-cols-2 xl:grid-cols-4">
        {PAID_PLANS.map((id) => (
          <PlanCard key={id} id={id} badge={BADGE[id]} highlight={id === "premium"}
            action={<PlanButton plan={id} current={prof?.plan === id} />} />
        ))}
      </div>
      <section className="card border-dashed border-accent/50">
        <h2 className="text-xl font-bold">Invita a un amigo y te damos {REFERRAL_BONUS} créditos</h2>
        <p className="mt-1 text-sm text-zinc-400">Tu código: <b className="select-all tracking-widest">{prof?.referral_code}</b></p>
      </section>
    </div>
  );
}
