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
export const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// cache(): dentro de una misma carga de página, la cabecera y la página comparten una sola consulta
// a Supabase (antes se repetía 2-3 veces y cada cambio de pestaña tardaba más).
export const requireUser = cache(async () => {
  const { data } = await (await sessionClient()).auth.getUser();
  return data.user;
});

// Perfil del usuario (plan, créditos, pruebas…), también compartido en la misma carga.
export const getProfile = cache(async (userId: string) => {
  const { data } = await admin().from("profiles").select("*").eq("id", userId).single();
  return data;
});
