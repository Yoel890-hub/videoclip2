import { NextResponse } from "next/server";
import { admin, requireUser } from "@/lib/supabase";
import { signedView } from "@/lib/storage";

// Vista previa: redirige al archivo (enlace temporal) para reproducirlo en la página.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  const { data: c } = await admin().from("clips").select("status,storage_key,expires_at").eq("id", id).eq("user_id", user.id).single();
  if (!c || c.status !== "ready" || !c.storage_key || new Date(c.expires_at) < new Date())
    return NextResponse.json({ error: "Clip no disponible" }, { status: 404 });
  return NextResponse.redirect(await signedView(c.storage_key));
}
