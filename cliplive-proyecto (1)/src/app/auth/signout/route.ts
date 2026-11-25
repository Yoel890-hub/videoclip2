import { NextResponse } from "next/server";
import { sessionClient } from "@/lib/supabase";

// Cierra la sesión y vuelve al login.
export async function POST() {
  await (await sessionClient()).auth.signOut();
  // Dirección relativa: en Render el servidor se ve a sí mismo como localhost:10000 y req.url llevaría ahí.
  return new NextResponse(null, { status: 303, headers: { Location: "/login" } });
}
