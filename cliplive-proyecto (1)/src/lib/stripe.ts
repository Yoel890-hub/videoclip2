import Stripe from "stripe";

// Stripe se crea al usarlo por primera vez (no al arrancar), para que la web funcione y compile
// aunque todavía no haya claves de Stripe en .env.local.
let client: Stripe | null = null;
export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Falta STRIPE_SECRET_KEY en .env.local");
  return (client ??= new Stripe(process.env.STRIPE_SECRET_KEY));
}
export const PRICE: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER, creator: process.env.STRIPE_PRICE_CREATOR, pro: process.env.STRIPE_PRICE_PRO,
  premium: process.env.STRIPE_PRICE_PREMIUM,
};
