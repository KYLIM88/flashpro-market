// app/api/stripe/webhook/route.js
import Stripe from "stripe";

// Ensure this runs on the Node.js runtime and isn't cached
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response("webhook endpoint is alive", { status: 200 });
}

export async function POST(req) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!webhookSecret || !stripeSecret) {
    console.error("❌ Missing STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY");
    return new Response("Server not configured for Stripe", { status: 500 });
  }
  if (!siteUrl) {
    console.error("❌ Missing NEXT_PUBLIC_SITE_URL");
    return new Response("Missing NEXT_PUBLIC_SITE_URL", { status: 500 });
  }

  // 1) Get the raw body string for signature verification
  const body = await req.text();

  // 👉 Hard check: Stripe must send this header or we 400 immediately
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    console.error("❌ Missing stripe-signature header");
    return new Response("Missing signature", { status: 400 });
  }

  let event;
  try {
    const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" });
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err?.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Helper to save purchase (your internal API)
  async function recordPurchaseFromSession(session) {
    const buyerEmail =
      session?.customer_details?.email || session?.customer_email || null;
    const deckId = session?.metadata?.deckId || null;

    if (!buyerEmail || !deckId) {
      console.error("❌ Missing buyerEmail or deckId in session metadata", {
        buyerEmail,
        deckId,
        sessionId: session?.id,
      });
      // Return 400 so Stripe retries only if metadata is fixed
      return new Response("Missing buyerEmail or deckId", { status: 400 });
    }

    try {
      const res = await fetch(`${siteUrl}/api/purchase/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerEmail,
          deckId,
          sessionId: session.id,
          paymentStatus: session.payment_status, // e.g. "paid"
          amountTotal: session.amount_total,     // integer, cents
          currency: session.currency,            // e.g. "sgd"
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("❌ Failed to save purchase:", res.status, text);
        // Non-2xx causes Stripe to retry
        return new Response("Failed to save purchase", { status: 500 });
      }

      console.log("✅ Purchase saved for", buyerEmail, "deck:", deckId);
      return new Response("ok", { status: 200 });
    } catch (e) {
      console.error("❌ Error calling /api/purchase/save:", e?.message);
      return new Response("Save error", { status: 500 });
    }
  }

  // 2) Handle relevant events (sync and async confirmation paths)
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        console.log("✅ checkout.session.completed:", session.id);
        const result = await recordPurchaseFromSession(session);
        if (result.status !== 200) return result;
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        console.log("✅ checkout.session.async_payment_succeeded:", session.id);
        const result = await recordPurchaseFromSession(session);
        if (result.status !== 200) return result;
        break;
      }
      default:
        console.log("ℹ️ Unhandled event:", event.type);
    }
  } catch (err) {
    console.error("❌ Webhook handler error:", err?.message);
    return new Response("Handler error", { status: 500 });
  }

  // 3) Always acknowledge receipt
  return new Response("ok", { status: 200 });
}
