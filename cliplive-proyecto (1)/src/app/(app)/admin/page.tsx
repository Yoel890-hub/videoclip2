import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase";
import { isOwner } from "@/lib/admin";
import { listAdmins } from "@/lib/admin-users";
import AdminAccounts from "@/components/AdminAccounts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administración", robots: { index: false } };

export default async function Admin() {
  const user = await requireUser();
  if (!isOwner(user)) notFound();   // solo el dueño (Dadito23)
  const admins = await listAdmins();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Administración</h1>
        <p className="mt-1 text-zinc-400">Los administradores tienen clips ilimitados con los límites del plan Premium, sin gastar créditos.</p>
      </div>
      <AdminAccounts admins={admins} me={user!.id} />
    </div>
  );
}
