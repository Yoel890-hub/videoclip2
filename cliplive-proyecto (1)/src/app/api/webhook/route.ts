import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";
import { PLANS, type PlanId } from "@/lib/plans";

export async function POST(req: Request) {
  const body = await req.text();
  let ev;
  try { ev = stripe.webhooks.constructEvent(body, req.headers.get("stripe-signature")!, process.env.STRIPE_WEBHOOK_SECRET!); }
  catch { return NextResponse.json({ error: "Firma inválida" }, { status: 400 }); }

  const db = admin();
  // Idempotencia: Stripe puede reenviar el mismo evento.
  const { error: dup } = await db.from("stripe_events").insert({ id: ev.id });
  if (dup) return NextResponse.json({ received: true, duplicate: true });

  // Concede créditos al pagar la primera cuota y en cada renovación mensual.
  if (ev.type === "invoice.paid") {
    const inv: any = ev.data.object;
    const meta = inv.subscription_details?.metadata ?? inv.parent?.subscription_details?.metadata;
    const plan = meta?.plan as PlanId | undefined, userId = meta?.user_id;
    if (plan && userId && PLANS[plan])
      await db.rpc("grant_credits", { p_user: userId, p_plan: plan, p_credits: PLANS[plan].credits, p_reason: `plan:${plan}` });
  }
  if (ev.type === "customer.subscription.deleted") {
    const userId = (ev.data.object as any).metadata?.user_id;
    if (userId) await db.from("profiles").update({ plan: "trial" }).eq("id", userId);
  }
  return NextResponse.json({ received: true });
}
