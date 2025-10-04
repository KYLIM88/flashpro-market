// app/api/stripe/webhook/route.js
import Stripe from "stripe";

// Avoid caching; ensure server runtime
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  // Simple health check for your browser: /api/stripe/webhook
  return new Response("webhook endpoint is alive", { status: 200 });
}

export async function POST(req) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Missing STRIPE_WEBHOOK_SECRET", { status: 500 });
  }

  // IMPORTANT: use the raw body for Stripe signature verification
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Handle events you care about
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    console.log("✅ checkout.session.completed:", session.id);
    // TODO: mark order paid, unlock deck, record purchase, etc.
  } else {
    console.log("ℹ️ Unhandled event:", event.type);
  }

  return new Response("ok", { status: 200 });
}
