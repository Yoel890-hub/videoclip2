import { NextResponse } from "next/server";
import { sessionClient } from "@/lib/supabase";

// Cierra la sesión y vuelve al login.
export async function POST(req: Request) {
  await (await sessionClient()).auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
