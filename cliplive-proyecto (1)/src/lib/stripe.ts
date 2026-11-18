import Stripe from "stripe";
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
export const PRICE: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER, creator: process.env.STRIPE_PRICE_CREATOR, pro: process.env.STRIPE_PRICE_PRO,
  premium: process.env.STRIPE_PRICE_PREMIUM,
};
