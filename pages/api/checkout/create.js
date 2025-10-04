// pages/api/checkout/create.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      amount,            // in cents, e.g. 500 = S$5.00
      currency = "sgd",
      deckId = "demo",
      deckName = "Deck",
      // sellerAccountId, // ignored in platform-only test
    } = req.body || {};

    // Basic validation
    const amt = Number(amount);
    if (!amt || Number.isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: "Invalid or missing amount (in cents)" });
    }

    const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // ✅ PLATFORM-ONLY TEST:
    // No transfer_data and NO application_fee_amount — charge goes to your platform account.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: deckName || `Deck ${deckId}` },
            unit_amount: amt,
          },
          quantity: 1,
        },
      ],
      success_url: `${site}/checkout/success?deckId=${encodeURIComponent(deckId)}`,
      cancel_url: `${site}/checkout/cancel?deckId=${encodeURIComponent(deckId)}`,
      // payment_intent_data: {} ← intentionally omitted
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Checkout create error:", err);
    return res.status(400).json({ error: err.message || "Unable to create checkout" });
  }
}
