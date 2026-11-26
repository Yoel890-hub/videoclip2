import { NextResponse } from "next/server";
import { admin, requireUser } from "@/lib/supabase";
import { isOwner } from "@/lib/admin";
import { findUserByEmail } from "@/lib/admin-users";
import { PAID_PLANS, PLANS, type PlanId } from "@/lib/plans";
import { displayName, toLoginEmail } from "@/lib/users";

const MIGRATION = "Falta preparar la base de datos: ejecuta supabase/migrations/0016_manual_plans.sql en Supabase (SQL Editor).";

async function guard() {
  const user = await requireUser();
  if (!user) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  if (!isOwner(user)) return { error: NextResponse.json({ error: "Solo el dueño de ClipLive puede dar planes en efectivo." }, { status: 403 }) };
  return { user };
}

// Dar (o alargar) un plan pagado en efectivo. Si la cuenta no existe, se crea con la contraseña indicada.
export async function POST(req: Request) {
  const g = await guard();
  if (g.error) return g.error;
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? toLoginEmail(body.id) : { error: "Escribe el usuario o el correo del cliente." };
  if ("error" in id) return NextResponse.json({ error: id.error }, { status: 400 });
  const plan = body?.plan as PlanId;
  if (!PAID_PLANS.includes(plan)) return NextResponse.json({ error: "Elige un plan." }, { status: 400 });
  const periods = Math.floor(Number(body?.periods));
  if (!(periods >= 1 && periods <= 24)) return NextResponse.json({ error: "Elige cuántos periodos pagó (1 a 24)." }, { status: 400 });
  const password = typeof body?.password === "string" ? body.password : "";
  const db = admin();

  let account = await findUserByEmail(id.email);
  let created = false;
  if (!account) {
    if (password.length < 8) return NextResponse.json({ error: "Esa cuenta no existe todavía. Pon una contraseña de al menos 8 caracteres para crearla." }, { status: 400 });
    const { data, error } = await db.auth.admin.createUser({
      email: id.email, password, email_confirm: true, user_metadata: id.isUsername ? { name: body.id.trim() } : {},
    });
    if (error || !data.user) {
      console.error("Crear cliente en efectivo", error?.message);
      return NextResponse.json({ error: "No se pudo crear la cuenta. Prueba con otro usuario o una contraseña más larga." }, { status: 500 });
    }
    account = data.user;
    created = true;
    await db.from("profiles").upsert({ id: account.id, email: account.email }, { onConflict: "id", ignoreDuplicates: true });
  }

  const p = PLANS[plan];
  const { data: endsAt, error } = await db.rpc("grant_manual_plan", {
    p_user: account.id, p_plan: plan, p_periods: periods, p_months: p.months, p_credits: p.weekly,
    p_note: `${periods}x por ${displayName(g.user.email)}`,
  });
  if (error) {
    if (error.message.includes("PAYPAL_ACTIVE")) return NextResponse.json({ error: "Este cliente tiene una suscripción de PayPal activa. Que la cancele primero en Planes." }, { status: 409 });
    if (error.code === "PGRST202" || /manual_plan|function .* does not exist/i.test(error.message)) return NextResponse.json({ error: MIGRATION }, { status: 503 });
    console.error("Plan en efectivo", error.message);
    return NextResponse.json({ error: "No se pudo asignar el plan." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, created, name: displayName(account.email), plan: p.name, credits: p.weekly, endsAt });
}

// Quitar el plan en efectivo ahora (la cuenta vuelve a Prueba).
export async function DELETE(req: Request) {
  const g = await guard();
  if (g.error) return g.error;
  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const { error } = await admin().rpc("remove_manual_plan", { p_user: userId });
  if (error) return NextResponse.json({ error: error.code === "PGRST202" ? MIGRATION : "No se pudo quitar el plan." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
