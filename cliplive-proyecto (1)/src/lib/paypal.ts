import { PAID_PLANS, PLANS, type PlanId } from "@/lib/plans";
import { paypalSdkUrl } from "@/lib/paypal-url";

// Los valores se limpian (espacios, comillas, saltos de línea) porque al pegarlos en Render es fácil colar uno.
// Ninguna clave de PayPal lleva espacios: se quitan todos (también los de en medio, que cuelan al copiar y pegar).
const clean = (v: string | undefined) => v?.replace(/["'s]+/g, "") || undefined;

const PLAN_IDS: Partial<Record<PlanId, string>> = {
  starter: clean(process.env.PAYPAL_PLAN_STARTER),
  creator: clean(process.env.PAYPAL_PLAN_CREATOR),
  pro: clean(process.env.PAYPAL_PLAN_PRO),
  premium: clean(process.env.PAYPAL_PLAN_PREMIUM),
};

// En los registros de Render queda dicho qué variable falta o está mal (una sola vez, sin mostrar valores).
let reported = false;
function reportConfig(problems: string[]) {
  if (reported || !problems.length) return;
  reported = true;
  console.error(`PayPal desactivado o incompleto. Revisa en Render → Environment: ${problems.join(" · ")}`);
}

export const paypalCheckoutId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const paypalSubscriptionId = /^I-[A-Z0-9]{1,48}$/i;
export const paypalUsdAmount = /^\d{1,10}(\.\d{1,2})?$/;

export function paypalConfig() {
  const clientId = clean(process.env.PAYPAL_CLIENT_ID), secret = clean(process.env.PAYPAL_CLIENT_SECRET);
  const webhookId = clean(process.env.PAYPAL_WEBHOOK_ID), environment = (clean(process.env.PAYPAL_ENV) ?? "sandbox").toLowerCase();
  const problems = [
    !clientId && "falta PAYPAL_CLIENT_ID",
    !secret && "falta PAYPAL_CLIENT_SECRET",
    !webhookId && "falta PAYPAL_WEBHOOK_ID",
    !["sandbox", "live"].includes(environment) && "PAYPAL_ENV debe ser live o sandbox",
    ...(Object.keys(PLAN_IDS) as PlanId[]).filter((p) => !/^P-[A-Z0-9]+$/i.test(PLAN_IDS[p] ?? ""))
      .map((p) => `PAYPAL_PLAN_${p.toUpperCase()} vacío o mal copiado (debe empezar por P-)`),
  ].filter(Boolean) as string[];
  reportConfig(problems);
  if (!clientId || !secret || !webhookId || !["sandbox", "live"].includes(environment)) return null;
  const base = environment === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  return { clientId, secret, webhookId, base };
}

export function paypalPlanId(plan: PlanId) {
  const id = PLAN_IDS[plan];
  return id && /^P-[A-Z0-9]+$/i.test(id) ? id : undefined;
}

// Comprueba desde el servidor que PayPal acepta el Client ID (si no, los botones no cargan en ningún navegador)
// y deja el motivo exacto en el registro de Render. Se guarda 10 min para no preguntar en cada visita.
let sdkCheck: { at: number; problem: string | null } | undefined;
export async function paypalSdkProblem(clientId: string) {
  if (sdkCheck && Date.now() - sdkCheck.at < 600_000) return sdkCheck.problem;
  let problem: string | null = null;
  try {
    const res = await fetch(paypalSdkUrl(clientId), { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!res.ok) {
      const text = await res.text();
      problem = text.match(/SDK Validation error: '([^']+)'/)?.[1] ?? `PayPal respondió ${res.status}`;
      console.error(`PayPal rechazó cargar los botones: ${problem}. Revisa PAYPAL_CLIENT_ID en Render → Environment ` +
        `(empieza por ${clientId.slice(0, 6)}…, termina en …${clientId.slice(-4)}, ${clientId.length} caracteres).`);
    }
  } catch { /* sin conexión con PayPal: que lo intente el navegador */ }
  sdkCheck = { at: Date.now(), problem };
  return problem;
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

export function paypalSubscriptionMatches(subscription: Subscription, id: string, checkoutId: string) {
  return subscription.id === id && subscription.custom_id === checkoutId
    && !subscription.plan_overridden && Number(subscription.quantity ?? 1) === 1
    && Number(subscription.shipping_amount?.value ?? 0) === 0;
}

// Recupera intentos anteriores cuyo navegador cerró PayPal sin entregar el ID de suscripción.
export async function findPayPalSubscription(checkoutId: string, planId: string, createdAt: string) {
  const started = Date.parse(createdAt);
  const search = new URLSearchParams({
    plan_ids: planId,
    created_after: new Date(started - 60_000).toISOString().replace(/\.\d{3}Z$/, "Z"),
    page_size: "20",
  });
  for (let page = 1; page <= 3; page++) {
    search.set("page", String(page));
    const result = await paypalRequest<{ subscriptions?: Subscription[]; links?: { rel: string }[] }>(`/v1/billing/subscriptions?${search}`);
    const match = result.subscriptions?.find((item) => item.custom_id === checkoutId && paypalSubscriptionId.test(item.id));
    if (match) return match.id;
    if (!result.links?.some(({ rel }) => rel === "next")) break;
  }
  return null;
}

type SubscriptionTransaction = {
  id: string;
  status: string;
  amount_with_breakdown?: { gross_amount?: Money };
};

export async function firstCompletedPayPalSale(subscriptionId: string, createdAt: string, price: number) {
  const now = Date.now();
  const start = Math.max(Date.parse(createdAt) - 60_000, now - 30 * 24 * 60 * 60_000);
  const search = new URLSearchParams({ start_time: new Date(start).toISOString(), end_time: new Date(now).toISOString() });
  const { transactions } = await paypalRequest<{ transactions?: SubscriptionTransaction[] }>(
    `/v1/billing/subscriptions/${subscriptionId}/transactions?${search}`,
  );
  for (const transaction of transactions ?? []) {
    const amount = transaction.amount_with_breakdown?.gross_amount;
    if (transaction.status === "COMPLETED" && typeof transaction.id === "string" && transaction.id.length > 0
      && amount?.currency_code === "USD" && paypalUsdAmount.test(amount.value) && Number(amount.value) === price) {
      return { id: transaction.id, amount: amount.value };
    }
  }
  return null;
}
