import { NextResponse } from "next/server";
import { admin, requireUser } from "@/lib/supabase";
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { code } = await req.json();
  const { data } = await admin().rpc("apply_referral", { p_new: user.id, p_code: String(code ?? "").slice(0, 16) });
  return NextResponse.json({ applied: !!data });
}
