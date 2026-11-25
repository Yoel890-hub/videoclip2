import { notFound } from "next/navigation";
import { admin, requireUser } from "@/lib/supabase";
import { isOwner } from "@/lib/admin";
import { listAdmins } from "@/lib/admin-users";
import { displayName } from "@/lib/users";
import AdminAccounts from "@/components/AdminAccounts";
import CashPlans, { type CashRow } from "@/components/CashPlans";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administración", robots: { index: false } };

export default async function Admin() {
  const user = await requireUser();
  if (!isOwner(user)) notFound();   // solo el dueño (Dadito23)
  const db = admin();
  await db.rpc("expire_manual_plans", {});   // los vencidos desaparecen de la lista al abrirla
  const [admins, cash] = await Promise.all([
    listAdmins(),
    db.from("profiles").select("id,email,plan,credits,plan_expires_at").eq("manual_plan", true).order("plan_expires_at"),
  ]);
  const rows: CashRow[] = (cash.data ?? []).map((p) => ({ id: p.id, name: displayName(p.email), plan: p.plan, credits: p.credits, expiresAt: p.plan_expires_at }));
  const setupError = cash.error ? "Para usar este apartado, primero ejecuta en Supabase (SQL Editor) el archivo supabase/migrations/0016_manual_plans.sql." : undefined;
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Administración</h1>
        <p className="mt-1 text-zinc-400">Clientes que pagan en efectivo y cuentas de administrador.</p>
      </div>
      <CashPlans rows={rows} setupError={setupError} />
      <div className="pt-2">
        <h2 className="mb-1 text-2xl font-extrabold">Administradores</h2>
        <p className="mb-4 text-sm text-zinc-400">Tienen clips ilimitados con los límites del plan Premium, sin gastar créditos.</p>
        <AdminAccounts admins={admins} me={user!.id} />
      </div>
    </div>
  );
}
