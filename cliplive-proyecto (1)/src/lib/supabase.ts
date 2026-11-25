import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";

export async function sessionClient() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => { try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch {} },
    },
  });
}
function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// Este cliente usa la clave del servidor. Las sesiones de los usuarios viven en sessionClient().
let adminClient: ReturnType<typeof createAdminClient>;
export function admin() {
  return adminClient ??= createAdminClient();
}

// cache(): dentro de una misma carga de página, la cabecera y la página comparten una sola consulta
// a Supabase (antes se repetía 2-3 veces y cada cambio de pestaña tardaba más).
// getClaims(): comprueba la firma de la sesión en este servidor con la clave pública de Supabase (ES256),
// sin un viaje de ~100 ms a Supabase en cada página. Si la sesión caducó, la renueva sola.
export type SessionUser = { id: string; email: string | null; user_metadata: Record<string, any> };
export const requireUser = cache(async (): Promise<SessionUser | null> => {
  const { data, error } = await (await sessionClient()).auth.getClaims();
  const c = data?.claims;
  if (error || !c?.sub) return null;
  return { id: c.sub, email: (c.email as string) ?? null, user_metadata: (c.user_metadata as Record<string, any>) ?? {} };
});

// Perfil del usuario (plan, créditos, pruebas…), también compartido en la misma carga.
// Si la cuenta no tiene perfil (p. ej. se registró cuando falló la función de alta), se crea en el momento
// con el plan de prueba, en vez de que la página falle con "Cannot read properties of null (reading 'plan')".
export const getProfile = cache(async (userId: string) => {
  const db = admin();
  const { data } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (data) return data;
  const { data: u } = await db.auth.admin.getUserById(userId);
  await db.from("profiles").upsert({ id: userId, email: u?.user?.email ?? null }, { onConflict: "id", ignoreDuplicates: true });
  const { data: created } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  return created;
});
