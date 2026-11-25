import { admin } from "@/lib/supabase";
import { ADMIN_ROLE, isFixedAdmin } from "@/lib/admin";
import { displayName } from "@/lib/users";

export type AdminRow = { id: string; name: string; fixed: boolean; createdAt: string; lastSignIn: string | null };

// Todas las cuentas de administrador (las de la web y las fijas de ADMIN_USERS que ya existen).
export async function listAdmins(): Promise<AdminRow[]> {
  const rows: AdminRow[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin().auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) {
      const fixed = isFixedAdmin(u.email);
      if (fixed || u.app_metadata?.role === ADMIN_ROLE)
        rows.push({ id: u.id, name: displayName(u.email), fixed, createdAt: u.created_at, lastSignIn: u.last_sign_in_at ?? null });
    }
    if (data.users.length < 1000) break;
  }
  return rows.sort((a, b) => Number(b.fixed) - Number(a.fixed) || a.name.localeCompare(b.name));
}

// Busca una cuenta por su correo de acceso (el de los usuarios es usuario@usuarios.cliplive.app).
export async function findUserByEmail(email: string) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin().auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return found;
    if (data.users.length < 1000) break;
  }
  return null;
}
