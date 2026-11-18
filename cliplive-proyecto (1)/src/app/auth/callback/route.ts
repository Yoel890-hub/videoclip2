import { NextResponse } from "next/server";
import { admin, sessionClient } from "@/lib/supabase";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code"), ref = url.searchParams.get("ref");
  // Solo rutas internas, para no redirigir fuera de la web.
  const nextParam = url.searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
  if (code) {
    const sb = await sessionClient();
    await sb.auth.exchangeCodeForSession(code);
    const { data } = await sb.auth.getUser();
    // Código de invitación: solo cuenta si el usuario es nuevo (apply_referral ignora a quien ya fue referido).
    if (data.user && ref) await admin().rpc("apply_referral", { p_new: data.user.id, p_code: ref.slice(0, 16) });
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
