import { PLANS, type PlanId } from "@/lib/plans";
import { toLoginEmail } from "@/lib/users";

// Administradores de dos tipos:
//  · Fijos: lista en ADMIN_USERS (Render → Environment), separada por comas. Acepta usuarios o correos.
//    Ej.: ADMIN_USERS=Dadito23,otro@correo.com. No se pueden quitar desde la web (así nunca te quedas fuera).
//  · Desde la web (Administración): se guardan en la cuenta de Supabase como app_metadata.role = "admin".
//    Los usuarios no pueden cambiar app_metadata: solo el servidor con la clave secreta.
const ADMINS = new Set(
  (process.env.ADMIN_USERS ?? "").split(",").map((s) => s.trim()).filter(Boolean)
    .map((s) => { const r = toLoginEmail(s); return "email" in r ? r.email.toLowerCase() : ""; }).filter(Boolean),
);

export const ADMIN_ROLE = "admin";
export const isFixedAdmin = (email?: string | null) => !!email && ADMINS.has(email.toLowerCase());

// Solo el dueño (los administradores fijos de ADMIN_USERS, p. ej. Dadito23) puede crear o quitar administradores.
export const isOwner = (user: MaybeUser) => !!user && isFixedAdmin(user.email);

type MaybeUser = { email?: string | null; app_metadata?: Record<string, unknown> | null } | null | undefined;
export const isAdmin = (user: MaybeUser) => !!user && (isFixedAdmin(user.email) || user.app_metadata?.role === ADMIN_ROLE);

// Límites efectivos: un admin tiene los del plan más alto (Premium), sin coste y sin gastar pruebas.
export function effectivePlan(plan: PlanId, admin: boolean) {
  return admin ? PLANS.premium : PLANS[plan];
}
