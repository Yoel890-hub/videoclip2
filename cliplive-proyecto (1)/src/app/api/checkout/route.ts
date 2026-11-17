import { NextResponse } from "next/server";
import { admin, requireUser } from "@/lib/supabase";
import { stripe, PRICE } from "@/lib/stripe";

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { plan } = await req.json();
  const price = PRICE[plan];
  if (!price) return NextResponse.json({ error: "Plan no válido" }, { status: 400 });
  const app = process.env.NEXT_PUBLIC_APP_URL!;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription", line_items: [{ price, quantity: 1 }], customer_email: user.email ?? undefined,
    client_reference_id: user.id, metadata: { user_id: user.id, plan },
    subscription_data: { metadata: { user_id: user.id, plan } },
    success_url: `${app}/planes?ok=1`, cancel_url: `${app}/planes`,
  });
  return NextResponse.json({ url: session.url });
}
