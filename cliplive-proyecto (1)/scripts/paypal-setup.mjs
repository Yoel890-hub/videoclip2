// Crea en PayPal todo lo que ClipLive necesita para cobrar: el producto, los 4 planes de suscripción
// (mismos precios y periodos que src/lib/plans.ts) y el webhook. Al final muestra las variables para Render.
// Si ya existen (por ejemplo, al ejecutarlo dos veces), los reutiliza en vez de duplicarlos.
//
//   node scripts/paypal-setup.mjs live      → cobros reales
//   node scripts/paypal-setup.mjs sandbox   → pruebas
//
// Pide el Client ID y el Secret de la app de PayPal (o léelos de PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET).
// No guarda nada en disco.
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const env = process.argv[2] ?? "live";
if (!["live", "sandbox"].includes(env)) { console.error("Uso: node scripts/paypal-setup.mjs live|sandbox"); process.exit(1); }
const SITE = (process.argv[3] ?? "https://clipvidieo.com").replace(/\/$/, "");
const BASE = env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
const EVENTS = ["PAYMENT.SALE.COMPLETED", "BILLING.SUBSCRIPTION.ACTIVATED", "BILLING.SUBSCRIPTION.CANCELLED", "BILLING.SUBSCRIPTION.EXPIRED"];
const PRODUCT_NAME = "ClipLive";

// Planes leídos de src/lib/plans.ts para que precios y periodos coincidan siempre con la web.
const plansTs = readFileSync(new URL("../src/lib/plans.ts", import.meta.url), "utf8");
const PLANS = ["starter", "creator", "pro", "premium"].map((key) => {
  const m = plansTs.match(new RegExp(`${key}:\\s*\\{\\s*name:\\s*"([^"]+)",\\s*price:\\s*([\\d.]+),\\s*months:\\s*(\\d+)`));
  if (!m) throw new Error(`No encontré el plan ${key} en src/lib/plans.ts`);
  return { key, name: m[1], price: Number(m[2]), months: Number(m[3]) };
});

const rl = createInterface({ input: stdin, output: stdout });
const lines = rl[Symbol.asyncIterator]();
// El Secret no se muestra en pantalla al pegarlo (para que no quede en capturas ni fotos).
let hidden = false;
rl._writeToOutput = (text) => { if (!hidden) stdout.write(text); };
async function ask(label, secret = false) {
  stdout.write(label);
  hidden = secret;
  const { value = "" } = await lines.next();
  hidden = false;
  if (secret) stdout.write("•••••• (oculto)\n");
  return value.trim();
}
const clientId = process.env.PAYPAL_CLIENT_ID || await ask(`Client ID de PayPal (${env}): `);
const secret = process.env.PAYPAL_CLIENT_SECRET || await ask(`Secret de PayPal (${env}, no se verá al pegarlo): `, true);
rl.close();
if (!clientId || !secret) { console.error("Faltan el Client ID o el Secret."); process.exit(1); }

const tokenRes = await fetch(`${BASE}/v1/oauth2/token`, {
  method: "POST",
  headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
  body: "grant_type=client_credentials",
});
if (!tokenRes.ok) {
  console.error(`\n✗ PayPal no aceptó las claves (${tokenRes.status}). Comprueba que son las de ${env === "live" ? "LIVE (no Sandbox)" : "Sandbox"}.`);
  process.exit(1);
}
const { access_token: token } = await tokenRes.json();

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${res.status} ${data?.name ?? ""} ${data?.details?.[0]?.description ?? data?.message ?? ""}`);
    err.data = data;
    throw err;
  }
  return data;
}

// 1. Producto
const products = (await api("GET", "/v1/catalogs/products?page_size=20")).products ?? [];
let product = products.find((p) => p.name === PRODUCT_NAME);
if (product) console.log(`✓ Producto «${PRODUCT_NAME}» ya existía (${product.id})`);
else {
  product = await api("POST", "/v1/catalogs/products", { name: PRODUCT_NAME, description: "Clips de directos y vídeos listos para redes", type: "SERVICE", category: "SOFTWARE", home_url: SITE });
  console.log(`✓ Producto «${PRODUCT_NAME}» creado (${product.id})`);
}

// 2. Planes (precio fijo en USD, sin prueba gratis, sin cuota inicial, renovación sin fin)
const existing = (await api("GET", `/v1/billing/plans?product_id=${product.id}&page_size=20`)).plans ?? [];
const ids = {};
for (const p of PLANS) {
  const name = `ClipLive ${p.name}`;
  const cycle = p.months === 12 ? { interval_unit: "YEAR", interval_count: 1 } : { interval_unit: "MONTH", interval_count: p.months };
  let found = null;
  for (const e of existing.filter((x) => x.name === name && x.status === "ACTIVE")) {
    const full = await api("GET", `/v1/billing/plans/${e.id}`);
    const c = full.billing_cycles?.[0];
    if (full.billing_cycles.length === 1 && Number(c?.pricing_scheme?.fixed_price?.value) === p.price
      && c.frequency.interval_unit === cycle.interval_unit && c.frequency.interval_count === cycle.interval_count) { found = full; break; }
  }
  if (found) { ids[p.key] = found.id; console.log(`✓ Plan ${p.name} ya existía (${found.id})`); continue; }
  const plan = await api("POST", "/v1/billing/plans", {
    product_id: product.id,
    name,
    description: `ClipLive ${p.name}: $${p.price} cada ${p.months === 12 ? "año" : p.months === 1 ? "mes" : `${p.months} meses`}`,
    status: "ACTIVE",
    billing_cycles: [{ frequency: cycle, tenure_type: "REGULAR", sequence: 1, total_cycles: 0,
      pricing_scheme: { fixed_price: { value: String(p.price), currency_code: "USD" } } }],
    payment_preferences: { auto_bill_outstanding: true, setup_fee: { value: "0", currency_code: "USD" },
      setup_fee_failure_action: "CANCEL", payment_failure_threshold: 1 },
  });
  ids[p.key] = plan.id;
  console.log(`✓ Plan ${p.name} creado: $${p.price} cada ${p.months} ${p.months === 1 ? "mes" : "meses"} (${plan.id})`);
}

// 3. Webhook (avisa a la web de cada cobro, alta y baja)
const url = `${SITE}/api/webhook/paypal`;
const hooks = (await api("GET", "/v1/notifications/webhooks")).webhooks ?? [];
let hook = hooks.find((h) => h.url === url);
if (hook) {
  const missing = EVENTS.filter((e) => !hook.event_types.some((t) => t.name === e));
  if (missing.length) {
    await api("PATCH", `/v1/notifications/webhooks/${hook.id}`, [{ op: "replace", path: "/event_types", value: EVENTS.map((name) => ({ name })) }]);
    console.log(`✓ Webhook ya existía; añadidos los eventos que faltaban (${hook.id})`);
  } else console.log(`✓ Webhook ya existía (${hook.id})`);
} else {
  hook = await api("POST", "/v1/notifications/webhooks", { url, event_types: EVENTS.map((name) => ({ name })) });
  console.log(`✓ Webhook creado → ${url} (${hook.id})`);
}

console.log(`
════════════════════════════════════════════════════════════
 Copia esto en Render → cliplive-web → Environment
 (el Client ID y el Secret son los mismos que acabas de escribir)
════════════════════════════════════════════════════════════
PAYPAL_ENV=${env}
PAYPAL_WEBHOOK_ID=${hook.id}
PAYPAL_PLAN_STARTER=${ids.starter}
PAYPAL_PLAN_CREATOR=${ids.creator}
PAYPAL_PLAN_PRO=${ids.pro}
PAYPAL_PLAN_PREMIUM=${ids.premium}
`);
