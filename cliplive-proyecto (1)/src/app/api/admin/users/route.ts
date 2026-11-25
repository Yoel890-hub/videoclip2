import { NextResponse } from "next/server";
import { admin, requireUser } from "@/lib/supabase";
import { ADMIN_ROLE, isFixedAdmin, isOwner } from "@/lib/admin";
import { findUserByEmail } from "@/lib/admin-users";
import { displayName, toLoginEmail } from "@/lib/users";

async function guard() {
  const user = await requireUser();
  if (!user) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  if (!isOwner(user)) return { error: NextResponse.json({ error: "Solo el dueño de ClipLive puede gestionar administradores." }, { status: 403 }) };
  return { user };
}

// Crear una cuenta de administrador nueva o dar permisos de administrador a una cuenta que ya existe.
export async function POST(req: Request) {
  const g = await guard();
  if (g.error) return g.error;
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? toLoginEmail(body.id) : { error: "Escribe un usuario o un correo." };
  if ("error" in id) return NextResponse.json({ error: id.error }, { status: 400 });
  const password = typeof body?.password === "string" ? body.password : "";
  const db = admin();

  const existing = await findUserByEmail(id.email);
  if (existing) {
    if (isFixedAdmin(existing.email) || existing.app_metadata?.role === ADMIN_ROLE)
      return NextResponse.json({ error: `${displayName(existing.email)} ya es administrador.` }, { status: 409 });
    const { error } = await db.auth.admin.updateUserById(existing.id, { app_metadata: { ...existing.app_metadata, role: ADMIN_ROLE } });
    if (error) return NextResponse.json({ error: "No se pudo dar permisos de administrador." }, { status: 500 });
    return NextResponse.json({ ok: true, created: false, name: displayName(existing.email) });
  }

  if (password.length < 8) return NextResponse.json({ error: "Esa cuenta no existe. Para crearla, pon una contraseña de al menos 8 caracteres." }, { status: 400 });
  const { data, error } = await db.auth.admin.createUser({
    email: id.email, password, email_confirm: true,
    app_metadata: { role: ADMIN_ROLE },
    user_metadata: id.isUsername ? { name: body.id.trim() } : {},
  });
  if (error || !data.user) {
    console.error("Crear administrador", error?.message);
    return NextResponse.json({ error: "No se pudo crear la cuenta. Prueba con otro usuario o una contraseña más larga." }, { status: 500 });
  }
  await db.from("profiles").upsert({ id: data.user.id, email: data.user.email }, { onConflict: "id", ignoreDuplicates: true });
  return NextResponse.json({ ok: true, created: true, name: displayName(data.user.email) }, { status: 201 });
}

// Quitar permisos de administrador (la cuenta sigue existiendo, como usuario normal).
export async function DELETE(req: Request) {
  const g = await guard();
  if (g.error) return g.error;
  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  if (userId === g.user.id) return NextResponse.json({ error: "No puedes quitarte los permisos a ti mismo." }, { status: 400 });
  const db = admin();
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data.user) return NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404 });
  if (isFixedAdmin(data.user.email))
    return NextResponse.json({ error: "Este administrador es fijo (está en ADMIN_USERS de Render) y no se puede quitar desde aquí." }, { status: 400 });
  const rest = { ...data.user.app_metadata };
  delete rest.role;
  const { error: e2 } = await db.auth.admin.updateUserById(userId, { app_metadata: { ...rest, role: null } });
  if (e2) return NextResponse.json({ error: "No se pudieron quitar los permisos." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
