import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Los proveedores de pago envían notificaciones sin una sesión de ClipLive.
export async function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  if (p === "/api/webhook" || p === "/api/webhook/paypal") return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  // getClaims(): verifica la sesión aquí mismo (firma ES256) en vez de preguntar a Supabase en cada clic.
  const { data: claims } = await supabase.auth.getClaims();
  const data = { user: claims?.claims?.sub ? { id: claims.claims.sub } : null };
  const open = p.startsWith("/login") || p.startsWith("/auth") || p.startsWith("/bienvenida");
  if (!data.user && !open) {
    if (p.startsWith("/api")) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    // La portada pública para quien llega a la raíz; el resto de páginas piden iniciar sesión.
    return NextResponse.redirect(new URL(p === "/" ? "/bienvenida" : "/login", req.url));
  }
  // Con sesión iniciada, la portada lleva directamente a la app.
  if (data.user && p.startsWith("/bienvenida")) return NextResponse.redirect(new URL("/", req.url));
  return res;
}
// Las imágenes y el icono de la pestaña son públicos (sin esto, sin sesión redirigirían al login).
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"] };
