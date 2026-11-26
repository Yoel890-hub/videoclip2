import { NextResponse } from "next/server";
import { admin, requireUser } from "@/lib/supabase";
import { BUCKET } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

// Renombrar un clip.
export async function PATCH(req: Request, { params }: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const title = String(b.title ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!title) return NextResponse.json({ error: "Escribe un nombre." }, { status: 400 });
  const { data, error } = await admin().from("clips").update({ title }).eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Clip no encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, title });
}

// Borrar un clip (archivo incluido). No se puede mientras se está creando.
export async function DELETE(_: Request, { params }: Ctx) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  const db = admin();
  const { data: c } = await db.from("clips").select("status,storage_key").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!c) return NextResponse.json({ error: "Clip no encontrado" }, { status: 404 });
  if (c.status === "queued" || c.status === "processing")
    return NextResponse.json({ error: "Espera a que termine de crearse para borrarlo." }, { status: 409 });
  if (c.storage_key) await db.storage.from(BUCKET).remove([c.storage_key, c.storage_key.replace(/\.mp4$/, ".thumb.jpg")]);
  const { error } = await db.from("clips").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "No se pudo borrar." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
