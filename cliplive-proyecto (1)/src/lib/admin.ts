import { PLANS, type PlanId } from "@/lib/plans";
import { toLoginEmail } from "@/lib/users";

// Administradores: lista en ADMIN_USERS (.env.local), separada por comas. Acepta usuarios o correos.
// Ej.: ADMIN_USERS=Dadito23,otro@correo.com
const ADMINS = new Set(
  (process.env.ADMIN_USERS ?? "").split(",").map((s) => s.trim()).filter(Boolean)
    .map((s) => { const r = toLoginEmail(s); return "email" in r ? r.email.toLowerCase() : ""; }).filter(Boolean),
);

export const isAdmin = (email?: string | null) => !!email && ADMINS.has(email.toLowerCase());

// Límites efectivos: un admin tiene los del plan más alto (Premium), sin coste y sin gastar pruebas.
export function effectivePlan(plan: PlanId, admin: boolean) {
  return admin ? PLANS.premium : PLANS[plan];
}
