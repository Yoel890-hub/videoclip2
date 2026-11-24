import { NextResponse } from "next/server";
import { paypalCheckoutId, paypalRequest, paypalSubscription, paypalSubscriptionEnded } from "@/lib/paypal";
import { admin, requireUser } from "@/lib/supabase";

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = body?.checkoutId;
  if (typeof id !== "string" || !paypalCheckoutId.test(id)) {
    return NextResponse.json({ error: "Suscripción no válida" }, { status: 400 });
  }

  try {
    const db = admin();
    const { data: checkout, error } = await db.from("paypal_checkouts")
      .select("subscription_id,paypal_plan_id,ended_at").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!checkout?.subscription_id) return NextResponse.json({ error: "Suscripción no encontrada" }, { status: 404 });
    if (checkout.ended_at) return new NextResponse(null, { status: 204 });

    const subscriptionId = checkout.subscription_id;
    try {
      await paypalRequest(`/v1/billing/subscriptions/${subscriptionId}/cancel`, {
        method: "POST", body: JSON.stringify({ reason: "El cliente canceló desde ClipLive" }),
      });
    } catch (error) {
      // Una cancelación simultánea o una respuesta perdida ya puede haberla dado de baja.
      const subscription = await paypalSubscription(subscriptionId);
      if (!paypalSubscriptionEnded(subscription.status)) throw error;
    }
    const { error: syncError } = await db.rpc("sync_paypal_subscription", {
      p_checkout: id, p_subscription: subscriptionId, p_paypal_plan: checkout.paypal_plan_id, p_ended: true,
    });
    if (syncError) throw syncError;
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Cancelación PayPal", error);
    return NextResponse.json({ error: "No pudimos confirmar la cancelación. Actualiza la página e inténtalo de nuevo." }, { status: 502 });
  }
}
