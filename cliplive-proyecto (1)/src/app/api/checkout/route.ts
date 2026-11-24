import { NextResponse } from "next/server";
import { admin, getProfile, requireUser } from "@/lib/supabase";
import { PAID_PLANS, PLANS, type PlanId } from "@/lib/plans";
import { paypalCheckoutId, paypalConfig, paypalPlanId, paypalPlanMatches } from "@/lib/paypal";

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const plan = body?.plan as PlanId;
  if (!PAID_PLANS.includes(plan)) return NextResponse.json({ error: "Plan no válido" }, { status: 400 });

  const planId = paypalPlanId(plan);
  if (!paypalConfig() || !planId) {
    return NextResponse.json({ error: "Los pagos de este plan aún no están disponibles." }, { status: 503 });
  }

  try {
    if (!await paypalPlanMatches(planId, plan)) throw new Error(`El plan ${plan} no coincide con el plan configurado en PayPal`);
    const profile = await getProfile(user.id);
    if (!profile) throw new Error("No se pudo cargar el perfil para iniciar el pago");
    const { data: checkoutId, error } = await admin().rpc("start_paypal_checkout", {
      p_user: user.id, p_plan: plan, p_paypal_plan: planId, p_price: PLANS[plan].price, p_credits: PLANS[plan].credits,
    });
    if (error) throw error;
    if (!checkoutId) {
      return NextResponse.json({ error: "Ya tienes una suscripción o un pago en curso. Actualiza la página antes de volver a intentarlo." }, { status: 409 });
    }
    return NextResponse.json({ checkoutId, planId });
  } catch (error) {
    console.error("Inicio de pago PayPal", error);
    return NextResponse.json({ error: "No pudimos iniciar el pago con PayPal. Inténtalo más tarde." }, { status: 503 });
  }
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = body?.checkoutId;
  if (typeof id !== "string" || !paypalCheckoutId.test(id)) {
    return NextResponse.json({ error: "Pago no válido" }, { status: 400 });
  }
  const { error } = await admin().from("paypal_checkouts").update({ released_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id).is("subscription_id", null);
  if (error) {
    console.error("Cierre de pago PayPal", error);
    return NextResponse.json({ error: "No pudimos cerrar el intento de pago." }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
