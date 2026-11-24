import { PAID_PLANS, PLANS, type PlanId } from "@/lib/plans";

const PLAN_IDS: Partial<Record<PlanId, string>> = {
  starter: process.env.PAYPAL_PLAN_STARTER,
  creator: process.env.PAYPAL_PLAN_CREATOR,
  pro: process.env.PAYPAL_PLAN_PRO,
  premium: process.env.PAYPAL_PLAN_PREMIUM,
};

export const paypalCheckoutId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const paypalSubscriptionId = /^I-[A-Z0-9]+$/i;

export function paypalConfig() {
  const { PAYPAL_CLIENT_ID: clientId, PAYPAL_CLIENT_SECRET: secret, PAYPAL_WEBHOOK_ID: webhookId,
    PAYPAL_ENV: environment = "sandbox" } = process.env;
  if (!clientId || !secret || !webhookId || !["sandbox", "live"].includes(environment)) return null;
  const base = environment === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  return { clientId, secret, webhookId, base };
}

export function paypalPlanId(plan: PlanId) {
  const id = PLAN_IDS[plan];
  return id && /^P-[A-Z0-9]+$/i.test(id) ? id : undefined;
}

export function paypalCheckoutOptions() {
  const config = paypalConfig();
  return {
    clientId: config?.clientId,
    plans: config ? PAID_PLANS.filter((plan) => paypalPlanId(plan)) : [],
  };
}

export class PayPalError extends Error {
  constructor(readonly status: number, debugId: string | null) {
    super(`PayPal HTTP ${status}${debugId ? ` (${debugId})` : ""}`);
  }
}

function checkResponse(response: Response) {
  if (!response.ok) throw new PayPalError(response.status, response.headers.get("paypal-debug-id"));
}

let accessToken: { value: string; expiresAt: number } | undefined;

export async function paypalRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const config = paypalConfig();
  if (!config) throw new Error("PayPal no está configurado");
  if (!accessToken || accessToken.expiresAt <= Date.now()) {
    const response = await fetch(`${config.base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    checkResponse(response);
    const token = await response.json();
    accessToken = { value: token.access_token, expiresAt: Date.now() + (token.expires_in - 60) * 1_000 };
  }
  const response = await fetch(`${config.base}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken.value}`, "Content-Type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 401) accessToken = undefined;
  checkResponse(response);
  return response.status === 204 ? undefined as T : response.json();
}

type Money = { currency_code: string; value: string };
type BillingPlan = {
  status: string;
  billing_cycles: {
    tenure_type: string;
    total_cycles: number;
    frequency: { interval_unit: string; interval_count: number };
    pricing_scheme?: { fixed_price?: Money; tiers?: unknown[] };
  }[];
  payment_preferences?: { setup_fee?: Money };
  taxes?: { percentage: string; inclusive?: boolean };
};

export async function paypalPlanMatches(id: string, plan: PlanId) {
  const remote = await paypalRequest<BillingPlan>(`/v1/billing/plans/${id}`);
  const [cycle] = remote.billing_cycles;
  const price = cycle?.pricing_scheme?.fixed_price;
  const months = cycle?.frequency.interval_unit === "YEAR" ? cycle.frequency.interval_count * 12
    : cycle?.frequency.interval_unit === "MONTH" ? cycle.frequency.interval_count : 0;
  const taxes = remote.taxes;
  return remote.status === "ACTIVE" && remote.billing_cycles.length === 1 && cycle.tenure_type === "REGULAR"
    && cycle.total_cycles === 0 && months === PLANS[plan].months && !cycle.pricing_scheme?.tiers?.length
    && price?.currency_code === "USD" && Number(price.value) === PLANS[plan].price
    && Number(remote.payment_preferences?.setup_fee?.value ?? 0) === 0
    && (!taxes || taxes.inclusive === true || Number(taxes.percentage) === 0);
}

type Subscription = {
  id: string;
  plan_id: string;
  custom_id?: string;
  status: string;
  quantity?: string;
  plan_overridden?: boolean;
  shipping_amount?: Money;
};

export const paypalSubscription = (id: string) => paypalRequest<Subscription>(`/v1/billing/subscriptions/${id}`);
export const paypalSubscriptionEnded = (status: string) => status === "CANCELLED" || status === "EXPIRED";
