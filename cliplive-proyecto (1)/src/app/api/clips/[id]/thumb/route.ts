import { NextResponse } from "next/server";
import { admin, requireUser } from "@/lib/supabase";
import { BUCKET } from "@/lib/storage";

// Portada del clip (JPG que guarda el worker junto al vídeo). Redirige a un enlace temporal de 1 h.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  const db = admin();
  const { data: c } = await db.from("clips").select("status,storage_key,expires_at").eq("id", id).eq("user_id", user.id).single();
  if (!c || c.status !== "ready" || !c.storage_key?.endsWith(".mp4") || new Date(c.expires_at) < new Date())
    return new NextResponse(null, { status: 404 });
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(c.storage_key.replace(/\.mp4$/, ".thumb.jpg"), 3600);
  if (error || !data) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, max-age=3000" } });
}
