import { admin, requireUser, getProfile } from "@/lib/supabase";
import { REFERRAL_BONUS } from "@/lib/plans";
import { paypalCheckoutOptions } from "@/lib/paypal";
import PayPalPlans from "@/components/PayPalPlans";

export default async function Planes() {
  const user = (await requireUser())!;
  const checkout = paypalCheckoutOptions();
  const [prof, result, recent] = await Promise.all([
    getProfile(user.id),
    checkout.clientId ? admin().from("paypal_checkouts").select("id,plan,paid_at").eq("user_id", user.id)
      .not("subscription_id", "is", null).is("ended_at", null).order("created_at", { ascending: false }) : null,
    checkout.clientId ? admin().from("paypal_checkouts").select("id").eq("user_id", user.id)
      .is("subscription_id", null).is("released_at", null).is("ended_at", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle() : null,
  ]);
  if (result?.error) console.error("Consulta de suscripciones PayPal", result.error);
  const subscriptions = (result?.data ?? []).map(({ id, plan, paid_at }) => ({ id, plan, paid: Boolean(paid_at) }));
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Mejora tu plan</h1>
        <p className="mt-1 text-zinc-400">Precios en dólares con renovación automática. Paga con PayPal o con tarjeta si PayPal la ofrece para tu compra.</p>
      </div>
      <PayPalPlans clientId={checkout.clientId} plans={result?.error ? [] : checkout.plans}
        current={prof?.plan} subscriptions={subscriptions} recentCheckoutId={recent?.data?.id} />
      <section className="card border-dashed border-accent/50">
        <h2 className="text-xl font-bold">Invita a un amigo y te damos {REFERRAL_BONUS} créditos</h2>
        <p className="mt-1 text-sm text-zinc-400">Tu código: <b className="select-all tracking-widest">{prof?.referral_code}</b></p>
      </section>
    </div>
  );
}
