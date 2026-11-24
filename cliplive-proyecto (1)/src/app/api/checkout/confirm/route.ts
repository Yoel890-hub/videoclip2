import { NextResponse } from "next/server";
import { admin, requireUser } from "@/lib/supabase";
import {
  findPayPalSubscription, firstCompletedPayPalSale, PayPalError, paypalCheckoutId, paypalSubscription,
  paypalSubscriptionEnded, paypalSubscriptionId, paypalSubscriptionMatches,
} from "@/lib/paypal";

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const checkoutId = body?.checkoutId;
  const givenId = body?.subscriptionId;
  if (typeof checkoutId !== "string" || !paypalCheckoutId.test(checkoutId)
    || (givenId !== undefined && (typeof givenId !== "string" || !paypalSubscriptionId.test(givenId)))) {
    return NextResponse.json({ error: "El intento de pago no es válido." }, { status: 400 });
  }

  try {
    const db = admin();
    const { data: checkout, error } = await db.from("paypal_checkouts")
      .select("paypal_plan_id,subscription_id,price,created_at,paid_at,ended_at")
      .eq("id", checkoutId).eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!checkout || (checkout.subscription_id && givenId && checkout.subscription_id !== givenId)) {
      return NextResponse.json({ error: "No encontramos este pago en tu cuenta." }, { status: 404 });
    }
    if (checkout.ended_at) return NextResponse.json({ state: "ended" });
    if (checkout.paid_at) return NextResponse.json({ state: "paid" });

    let subscriptionId = checkout.subscription_id ?? givenId;
    if (!subscriptionId) {
      try {
        subscriptionId = await findPayPalSubscription(checkoutId, checkout.paypal_plan_id, checkout.created_at);
      } catch (error) {
        if (!(error instanceof PayPalError) || ![400, 403, 404, 405].includes(error.status)) throw error;
        console.warn("Búsqueda de suscripciones PayPal", error.message);
      }
      if (!subscriptionId) return NextResponse.json({ state: "needs_reference" });
    }

    const subscription = await paypalSubscription(subscriptionId).catch((error) => {
      if (error instanceof PayPalError && error.status === 404 && !checkout.subscription_id) return null;
      throw error;
    });
    if (!subscription) return NextResponse.json({ state: "needs_reference" });
    if (subscription.plan_id !== checkout.paypal_plan_id || !paypalSubscriptionMatches(subscription, subscriptionId, checkoutId)) {
      return NextResponse.json({ error: "PayPal no pudo vincular esta suscripción con tu compra." }, { status: 409 });
    }
    if (subscription.status === "APPROVAL_PENDING") return NextResponse.json({ state: "awaiting_approval" });

    const ended = paypalSubscriptionEnded(subscription.status);
    const sync = async (sale?: { id: string; amount: string }) => {
      const { data, error: syncError } = await db.rpc("sync_paypal_subscription", {
        p_checkout: checkoutId, p_subscription: subscriptionId, p_paypal_plan: subscription.plan_id,
        p_ended: ended, ...(sale ? { p_sale: sale.id, p_amount: sale.amount } : {}),
      });
      if (syncError || !data) throw syncError ?? new Error("No se pudo vincular el pago con su suscripción");
    };
    if (ended || !checkout.subscription_id) await sync();
    if (ended) return NextResponse.json({ state: "ended" });
    if (subscription.status !== "ACTIVE") return NextResponse.json({ state: "pending" });

    const sale = await firstCompletedPayPalSale(subscriptionId, checkout.created_at, Number(checkout.price));
    if (!sale) return NextResponse.json({ state: "pending" });
    await sync(sale);
    return NextResponse.json({ state: "paid" });
  } catch (error) {
    console.error("Verificación de pago PayPal", error);
    return NextResponse.json({ error: "No pudimos consultar PayPal. Puedes verificar el pago de nuevo en unos minutos." }, { status: 502 });
  }
}
