"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PAID_PLANS, PLANS, type PlanId } from "@/lib/plans";
import PlanCard from "@/components/PlanCard";
import { paypalSdkUrl } from "@/lib/paypal-url";

type PayPalButtons = {
  render: (target: HTMLElement) => Promise<void>;
  close: () => Promise<void>;
  isEligible: () => boolean;
};

type PayPalSdk = {
  Buttons: (options: {
    style: { layout: "vertical"; label: "subscribe"; shape: "rect" };
    createSubscription: (_data: unknown, actions: {
      subscription: { create: (details: { plan_id: string; custom_id: string; application_context: { shipping_preference: "NO_SHIPPING" } }) => Promise<string> };
    }) => Promise<string>;
    onApprove: (data: { subscriptionID?: string }) => void;
    onCancel: () => Promise<void>;
    onError: () => void;
  }) => PayPalButtons;
};

const BADGE: Partial<Record<PlanId, string>> = { creator: "El más elegido", premium: "Mejor precio" };
const LOAD_ERROR = "No pudimos cargar PayPal. Actualiza la página para volver a intentarlo.";
type CheckoutReference = { checkoutId: string; subscriptionId?: string };
const SUBSCRIPTION_REFERENCE = "cliplive-paypal-checkout";
const PAYMENT_MESSAGES: Record<string, string> = {
  paid: "PayPal confirmó el cobro. Acreditamos los créditos de tu plan.",
  pending: "PayPal registró la suscripción. El cobro todavía está pendiente de confirmación.",
  awaiting_approval: "PayPal todavía no confirma la aprobación de este intento.",
  needs_reference: "Si aprobaste la compra, escribe el ID de suscripción que aparece en PayPal o en su correo de confirmación.",
  ended: "Esta suscripción ya terminó.",
};

function PlanButton({ plan, onApproved }: { plan: PlanId; onApproved: (checkout: CheckoutReference) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const sdk = (window as Window & { paypal?: PayPalSdk }).paypal;
    if (!sdk || !host.current) { setMessage(LOAD_ERROR); return; }
    const target = document.createElement("div");
    host.current.append(target);
    let checkoutId: string | undefined;
    let createdSubscriptionId: string | undefined;
    let startError = "";
    let disposed = false;

    const buttons = sdk.Buttons({
      style: { layout: "vertical", label: "subscribe", shape: "rect" },
      async createSubscription(_data, actions) {
        startError = "";
        setMessage("");
        const response = await fetch("/api/checkout", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.checkoutId) {
          startError = result?.error ?? "No pudimos iniciar el pago. Inténtalo de nuevo.";
          throw new Error(startError);
        }
        checkoutId = result.checkoutId;
        createdSubscriptionId = await actions.subscription.create({ plan_id: result.planId, custom_id: result.checkoutId,
          application_context: { shipping_preference: "NO_SHIPPING" } });
        try {
          localStorage.setItem(SUBSCRIPTION_REFERENCE, JSON.stringify({ checkoutId, subscriptionId: createdSubscriptionId }));
        } catch { /* PayPal funciona también sin almacenamiento del navegador. */ }
        return createdSubscriptionId;
      },
      onApprove({ subscriptionID }) {
        if (!disposed && checkoutId) onApproved({ checkoutId, subscriptionId: subscriptionID ?? createdSubscriptionId });
      },
      async onCancel() {
        if (disposed) return;
        setMessage("Cerraste el pago en PayPal.");
        if (checkoutId) {
          await fetch("/api/checkout", {
            method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkoutId }),
          }).catch(() => undefined);
          checkoutId = undefined;
        }
      },
      onError() {
        if (!disposed) setMessage(startError || "PayPal no pudo completar el pago. Revisa su estado antes de volver a intentarlo.");
      },
    });

    if (buttons.isEligible()) {
      void buttons.render(target).catch(() => { if (!disposed) setMessage(LOAD_ERROR); });
    } else {
      setMessage("PayPal no está disponible para esta compra.");
    }
    return () => {
      disposed = true;
      target.remove();
      void buttons.close().catch(() => undefined);
    };
  }, [plan, onApproved]);

  return <><div ref={host} />{message && <p role="status" className="mt-2 text-sm text-zinc-300">{message}</p>}</>;
}

export default function PayPalPlans({ clientId, plans, current, subscriptions, recentCheckoutId }: {
  clientId?: string;
  plans: PlanId[];
  current?: PlanId;
  subscriptions: { id: string; plan: PlanId; paid: boolean }[];
  recentCheckoutId?: string;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [approval, setApproval] = useState<CheckoutReference | null>(null);
  const [checking, setChecking] = useState(false);
  const [paymentState, setPaymentState] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [manualReference, setManualReference] = useState("");
  const verificationBusy = useRef(false);
  const [cancelling, setCancelling] = useState<string>();
  const [cancelError, setCancelError] = useState("");
  const pendingId = approval?.checkoutId ?? subscriptions.find((subscription) => !subscription.paid)?.id;
  const approvedSubscriptionId = approval?.subscriptionId;
  const paid = subscriptions.some((subscription) => subscription.paid);
  const canBuy = !pendingId && subscriptions.length === 0;
  const targetId = pendingId ?? recentCheckoutId;

  const verifyPayment = useCallback(async (checkout: CheckoutReference) => {
    if (verificationBusy.current) return;
    verificationBusy.current = true;
    setChecking(true);
    try {
      if (!checkout.subscriptionId) {
        try {
          const saved = JSON.parse(localStorage.getItem(SUBSCRIPTION_REFERENCE) ?? "null") as CheckoutReference | null;
          if (saved?.checkoutId === checkout.checkoutId) checkout = saved;
        } catch { /* El servidor también puede verificar el intento. */ }
      }
      const response = await fetch("/api/checkout/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(checkout),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.state) throw new Error(result?.error ?? "No pudimos verificar el pago.");
      setPaymentState(result.state);
      setPaymentMessage(PAYMENT_MESSAGES[result.state] ?? "PayPal sigue verificando este intento.");
      if (result.state === "ended") setApproval(null);
      router.refresh();
    } catch (error) {
      setPaymentMessage(error instanceof Error ? error.message : "No pudimos verificar el pago.");
    } finally {
      verificationBusy.current = false;
      setChecking(false);
    }
  }, [router]);

  const onApproved = useCallback((checkout: CheckoutReference) => {
    setPaymentState("");
    setPaymentMessage("");
    setApproval(checkout);
  }, []);

  useEffect(() => {
    if (paid) { setApproval(null); return; }
    if (!targetId) return;
    const checkout = { checkoutId: targetId, subscriptionId: approvedSubscriptionId };
    void verifyPayment(checkout);
    if (!pendingId) return;
    const timer = setInterval(() => void verifyPayment(checkout), 6_000);
    const stop = setTimeout(() => clearInterval(timer), 30_000);
    return () => { clearInterval(timer); clearTimeout(stop); };
  }, [paid, pendingId, targetId, approvedSubscriptionId, verifyPayment]);

  async function cancelSubscription(id: string) {
    if (!window.confirm("¿Cancelar la suscripción? Se detendrán los cobros y se desactivará este plan de inmediato.")) return;
    setCancelling(id);
    setCancelError("");
    try {
      const response = await fetch("/api/checkout/cancel", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkoutId: id }),
      });
      if (!response.ok) throw new Error("PayPal no confirmó la cancelación");
      setApproval(null);
      setPaymentMessage("");
      router.refresh();
    } catch {
      setCancelError("No pudimos confirmar la cancelación. Actualiza la página e inténtalo de nuevo.");
    } finally {
      setCancelling(undefined);
    }
  }

  const sdkUrl = clientId ? paypalSdkUrl(clientId) : null;

  return (
    <>
      {sdkUrl && plans.length > 0 && canBuy && <Script src={sdkUrl} onReady={() => setReady(true)} onError={() => setFailed(true)} />}
      {canBuy && (!plans.length || failed) && <p role="status" className="text-sm text-zinc-300">{failed ? LOAD_ERROR : "Los pagos aún no están disponibles."}</p>}
      {paymentMessage && paid && <p role="status" className="text-sm text-zinc-300">{paymentMessage}</p>}
      {targetId && !paid && (
        <div className="card space-y-3">
          <p role="status">{paymentMessage || (pendingId ? "Estamos comprobando el cobro con PayPal." : "¿Ya aprobaste el pago en PayPal?")}</p>
          <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => {
            event.preventDefault();
            const reference = manualReference.trim().toUpperCase();
            void verifyPayment({ checkoutId: targetId, subscriptionId: reference || approvedSubscriptionId });
          }}>
            {paymentState === "needs_reference" && (
              <label className="flex flex-col gap-1 text-sm">
                ID de suscripción de PayPal
                <input className="input" value={manualReference} onChange={(event) => setManualReference(event.target.value)}
                  placeholder="I-…" maxLength={50} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
              </label>
            )}
            <button type="submit" className="btn-ghost" disabled={checking}>{checking ? "Verificando…" : "Verificar pago"}</button>
          </form>
          {approval && subscriptions.length === 0 && paymentState === "awaiting_approval" && (
            <button type="button" className="btn-ghost" onClick={() => setApproval(null)}>Volver a los planes</button>
          )}
        </div>
      )}
      {subscriptions.map(({ id, plan }) => (
        <div key={id} className="card flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold">Suscripción PayPal · {PLANS[plan].name}</p>
          <button type="button" className="btn-ghost" disabled={Boolean(cancelling)} onClick={() => cancelSubscription(id)}>
            {cancelling === id ? "Cancelando…" : "Cancelar suscripción"}
          </button>
        </div>
      ))}
      {cancelError && <p role="alert" className="text-sm text-red-400">{cancelError}</p>}
      <div className="grid gap-5 pt-4 sm:grid-cols-2 xl:grid-cols-4">
        {PAID_PLANS.map((id) => (
          <PlanCard key={id} id={id} badge={BADGE[id]} highlight={id === "premium"}
            action={canBuy && current !== id && plans.includes(id) && ready && !failed
              ? <PlanButton plan={id} onApproved={onApproved} />
              : <button type="button" className="btn-primary w-full" disabled>{current === id ? "Plan actual"
                : pendingId ? "Pago por confirmar" : paid ? "Ya tienes un plan" : !plans.includes(id) || failed ? "No disponible" : "Cargando PayPal…"}</button>}
          />
        ))}
      </div>
    </>
  );
}
