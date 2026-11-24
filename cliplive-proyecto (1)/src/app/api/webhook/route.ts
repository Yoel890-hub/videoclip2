import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { PAID_PLANS, PLANS, type PlanId } from "@/lib/plans";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!process.env.STRIPE_SECRET_KEY || !secret) return NextResponse.json({ error: "Stripe no configurado" }, { status: 503 });
  const body = await req.text();
  let ev;
  try { ev = getStripe().webhooks.constructEvent(body, req.headers.get("stripe-signature")!, secret); }
  catch { return NextResponse.json({ error: "Firma inválida" }, { status: 400 }); }

  let userId: string | undefined;
  let plan: PlanId | null = null;
  if (ev.type === "invoice.paid") {
    const inv: any = ev.data.object;
    const meta = inv.subscription_details?.metadata ?? inv.parent?.subscription_details?.metadata;
    if (PAID_PLANS.includes(meta?.plan)) { userId = meta.user_id; plan = meta.plan; }
  } else if (ev.type === "customer.subscription.deleted") {
    userId = ev.data.object.metadata?.user_id;
  }
  if (userId) {
    const { error } = await admin().rpc("record_stripe_event", {
      p_event: ev.id, p_user: userId, p_plan: plan, p_credits: plan ? PLANS[plan].credits : 0,
    });
    if (error) {
      console.error("Notificación Stripe", error);
      return NextResponse.json({ error: "No pudimos procesar la notificación" }, { status: 500 });
    }
  }
  return NextResponse.json({ received: true });
}
