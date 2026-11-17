import { NextResponse } from "next/server";
import { admin, requireUser } from "@/lib/supabase";
import { signedDownload } from "@/lib/storage";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  const { data: c } = await admin().from("clips").select("*").eq("id", id).eq("user_id", user.id).single();
  if (!c || c.status !== "ready" || !c.storage_key || new Date(c.expires_at) < new Date())
    return NextResponse.json({ error: "Clip no disponible" }, { status: 404 });
  const ext = c.format === "audio" ? "mp3" : c.format === "image" ? "jpg" : "mp4";
  return NextResponse.redirect(await signedDownload(c.storage_key, `cliplive-${id.slice(0, 8)}.${ext}`));
}
