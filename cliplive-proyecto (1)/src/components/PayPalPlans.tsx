"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PAID_PLANS, PLANS, type PlanId } from "@/lib/plans";
import PlanCard from "@/components/PlanCard";

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
    onApprove: () => void;
    onCancel: () => Promise<void>;
    onError: () => void;
  }) => PayPalButtons;
};

const BADGE: Partial<Record<PlanId, string>> = { creator: "El más elegido", premium: "Mejor precio" };
const LOAD_ERROR = "No pudimos cargar PayPal. Actualiza la página para volver a intentarlo.";

function PlanButton({ plan, onApproved }: { plan: PlanId; onApproved: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const sdk = (window as Window & { paypal?: PayPalSdk }).paypal;
    if (!sdk || !host.current) { setMessage(LOAD_ERROR); return; }
    const target = document.createElement("div");
    host.current.append(target);
    let checkoutId: string | undefined;
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
        return actions.subscription.create({ plan_id: result.planId, custom_id: result.checkoutId,
          application_context: { shipping_preference: "NO_SHIPPING" } });
      },
      onApprove: onApproved,
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

export default function PayPalPlans({ clientId, plans, current, subscriptions }: {
  clientId?: string;
  plans: PlanId[];
  current?: PlanId;
  subscriptions: { id: string; plan: PlanId; paid: boolean }[];
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [cancelling, setCancelling] = useState<string>();
  const [cancelError, setCancelError] = useState("");
  const pending = waiting || subscriptions.some((subscription) => !subscription.paid);
  const paid = subscriptions.some((subscription) => subscription.paid);
  const canBuy = !waiting && subscriptions.length === 0;

  const onApproved = useCallback(() => {
    setWaiting(true);
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (paid) { setWaiting(false); return; }
    if (!pending) return;
    const timer = setInterval(() => router.refresh(), 2_000);
    const stop = setTimeout(() => clearInterval(timer), 30_000);
    return () => { clearInterval(timer); clearTimeout(stop); };
  }, [paid, pending, router]);

  async function cancelSubscription(id: string) {
    if (!window.confirm("¿Cancelar la suscripción? Se detendrán los cobros y se desactivará este plan de inmediato.")) return;
    setCancelling(id);
    setCancelError("");
    try {
      const response = await fetch("/api/checkout/cancel", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkoutId: id }),
      });
      if (!response.ok) throw new Error("PayPal no confirmó la cancelación");
      setWaiting(false);
      router.refresh();
    } catch {
      setCancelError("No pudimos confirmar la cancelación. Actualiza la página e inténtalo de nuevo.");
    } finally {
      setCancelling(undefined);
    }
  }

  const sdkUrl = clientId ? `https://www.paypal.com/sdk/js?${new URLSearchParams({
    "client-id": clientId, currency: "USD", vault: "true", intent: "subscription", "enable-funding": "card",
  })}` : null;

  return (
    <>
      {sdkUrl && plans.length > 0 && canBuy && <Script src={sdkUrl} onReady={() => setReady(true)} onError={() => setFailed(true)} />}
      {canBuy && (!plans.length || failed) && <p role="status" className="text-sm text-zinc-300">{failed ? LOAD_ERROR : "Los pagos aún no están disponibles."}</p>}
      {pending && !paid && (
        <div className="card flex flex-wrap items-center gap-4" role="status">
          <p>Estamos esperando la confirmación del cobro de PayPal.</p>
          <button type="button" className="btn-ghost" onClick={() => router.refresh()}>Actualizar estado</button>
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
                : !canBuy || !plans.includes(id) || failed ? "No disponible" : "Cargando PayPal…"}</button>}
          />
        ))}
      </div>
    </>
  );
}
