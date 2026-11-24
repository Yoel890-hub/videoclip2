import { NextResponse } from "next/server";
import {
  paypalCheckoutId, paypalConfig, paypalRequest, paypalSubscription, paypalSubscriptionEnded,
  paypalSubscriptionId, paypalSubscriptionMatches, paypalUsdAmount,
} from "@/lib/paypal";
import { admin } from "@/lib/supabase";

const EVENTS = new Set([
  "PAYMENT.SALE.COMPLETED",
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.EXPIRED",
]);

export async function POST(req: Request) {
  const config = paypalConfig();
  if (!config) return NextResponse.json({ error: "PayPal no configurado" }, { status: 503 });
  const signature = {
    auth_algo: req.headers.get("paypal-auth-algo"),
    cert_url: req.headers.get("paypal-cert-url"),
    transmission_id: req.headers.get("paypal-transmission-id"),
    transmission_sig: req.headers.get("paypal-transmission-sig"),
    transmission_time: req.headers.get("paypal-transmission-time"),
  };
  const rawEvent = await req.text();
  let event;
  try { event = JSON.parse(rawEvent); }
  catch { return NextResponse.json({ error: "Notificación inválida" }, { status: 400 }); }
  if (Object.values(signature).some((value) => !value) || typeof event?.event_type !== "string" || !event?.id) {
    return NextResponse.json({ error: "Notificación inválida" }, { status: 400 });
  }

  try {
    const verification = JSON.stringify({ ...signature, webhook_id: config.webhookId });
    const { verification_status } = await paypalRequest<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", {
      method: "POST",
      // PayPal comprueba el contenido original, incluidos sus espacios y saltos de línea.
      body: `${verification.slice(0, -1)},"webhook_event":${rawEvent}}`,
    });
    if (verification_status !== "SUCCESS") return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
    if (!EVENTS.has(event.event_type)) return NextResponse.json({ received: true });

    const resource = event.resource;
    const sale = event.event_type === "PAYMENT.SALE.COMPLETED";
    const subscriptionId = sale ? resource?.billing_agreement_id : resource?.id;
    if (typeof subscriptionId !== "string" || !paypalSubscriptionId.test(subscriptionId)) {
      return NextResponse.json({ received: true });
    }

    const subscription = await paypalSubscription(subscriptionId);
    const checkoutId = subscription.custom_id;
    if (!checkoutId || !paypalCheckoutId.test(checkoutId)) return NextResponse.json({ received: true });
    if (!paypalSubscriptionMatches(subscription, subscriptionId, checkoutId)) {
      throw new Error(`Condiciones inesperadas de la suscripción ${subscriptionId}`);
    }

    const amount = resource.amount?.total;
    if (sale && (typeof resource.id !== "string" || !resource.id || resource.amount?.currency !== "USD"
      || typeof amount !== "string" || !paypalUsdAmount.test(amount))) {
      throw new Error(`Importe o identificador inesperado en la venta ${event.id}`);
    }
    const ended = paypalSubscriptionEnded(subscription.status)
      || event.event_type === "BILLING.SUBSCRIPTION.CANCELLED" || event.event_type === "BILLING.SUBSCRIPTION.EXPIRED";
    const { error } = await admin().rpc("sync_paypal_subscription", {
      p_checkout: checkoutId, p_subscription: subscriptionId, p_paypal_plan: subscription.plan_id,
      p_ended: ended, ...(sale ? { p_sale: resource.id, p_amount: amount } : {}),
    });
    if (error) throw error;
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Notificación PayPal", error);
    return NextResponse.json({ error: "No pudimos procesar la notificación" }, { status: 500 });
  }
}
