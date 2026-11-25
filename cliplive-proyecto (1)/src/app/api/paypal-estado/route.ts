import { NextResponse } from "next/server";
import { paypalCheckoutOptions, paypalConfig } from "@/lib/paypal";
import { paypalSdkUrl } from "@/lib/paypal-url";

export const dynamic = "force-dynamic";

// Diagnóstico de PayPal sin datos secretos: el Client ID es público (lo recibe el navegador de cada visitante).
// Nunca muestra el Secret.
export async function GET() {
  const config = paypalConfig();
  const { clientId, plans } = paypalCheckoutOptions();
  let sdk: { status: number; error: string | null } | null = null;
  if (clientId) {
    try {
      const res = await fetch(paypalSdkUrl(clientId), { cache: "no-store", signal: AbortSignal.timeout(8_000) });
      const text = res.ok ? "" : await res.text();
      sdk = { status: res.status, error: text.match(/SDK Validation error: '([^']+)'/)?.[1] ?? (res.ok ? null : text.slice(0, 200)) };
    } catch (e) { sdk = { status: 0, error: (e as Error).message }; }
  }
  return NextResponse.json({
    entorno: config ? (config.base.includes("sandbox") ? "sandbox" : "live") : "sin configurar",
    clientId: clientId ?? null,
    planesDisponibles: plans,
    webhook: Boolean(config?.webhookId),
    botonesDesdeElServidor: sdk,
  });
}
