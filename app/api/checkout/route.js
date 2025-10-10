// flashpro-market/app/api/checkout/route.js
import Stripe from "stripe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  try {
    const { deckId, uid, customerId, sellerAccountId } = await req.json();

    if (!deckId || !uid) {
      return NextResponse.json(
        { error: "Missing deckId or uid" },
        { status: 400 }
      );
    }

    const price = 500; // S$5 (in cents)

    // If seller exists → add platform fee + transfer destination
    let payment_intent_data = undefined;
    if (sellerAccountId) {
      payment_intent_data = {
        application_fee_amount: Math.round(price * 0.12), // 12% platform fee
        transfer_data: { destination: sellerAccountId },
      };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer: customerId || undefined,
      currency: "sgd",
      line_items: [
        {
          price_data: {
            currency: "sgd",
            product_data: { name: `Deck ${deckId}` },
            unit_amount: price,
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/cancel`,
      metadata: {
        deckId,
        uid,
        sellerAccountId: sellerAccountId || "",
      },
      payment_intent_data, // can be undefined safely
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("❌ /api/checkout error:", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Use POST" }, { status: 405 });
}
