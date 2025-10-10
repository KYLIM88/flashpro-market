// flashpro-market/app/api/stripe/webhook/route.js
import Stripe from "stripe";
import { db } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response("✅ Webhook endpoint is alive", { status: 200 });
}

export async function POST(req) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // 1️⃣ Get raw body + signature for verification
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !webhookSecret) {
    console.error("❌ Missing Stripe signature or webhook secret");
    return new Response("Missing signature or secret", { status: 400 });
  }

  // 2️⃣ Verify event
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // 3️⃣ Handle successful checkout
  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const uid = s.metadata?.uid;
    const deckId = s.metadata?.deckId;

    console.log("✅ checkout.session.completed:", s.id, uid, deckId);

    if (!uid || !deckId) {
      console.error("❌ Missing uid or deckId in session metadata");
      return new Response("Missing uid or deckId", { status: 400 });
    }

    try {
      await db.doc(`users/${uid}/purchases/${deckId}`).set(
        {
          deckId,
          sessionId: s.id,
          amountTotal: s.amount_total,
          currency: s.currency,
          purchasedAt: new Date(),
          paymentStatus: s.payment_status,
          source: "stripe",
        },
        { merge: true }
      );

      console.log("✅ Purchase saved to Firestore for:", uid, deckId);
    } catch (error) {
      console.error("❌ Firestore write error:", error.message);
      return new Response("Database error", { status: 500 });
    }
  } else {
    console.log("ℹ️ Unhandled event type:", event.type);
  }

  // 4️⃣ Always respond 200 to Stripe
  return new Response("ok", { status: 200 });
}
