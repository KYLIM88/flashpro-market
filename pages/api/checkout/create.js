// pages/api/checkout/create.js
import Stripe from "stripe";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const { deckId, deckName, amount, currency, sellerAccountId } = req.body || {};

  // 🧮 Default values if missing
  const priceAmount = Number(amount) || 500; // 500 = S$5.00
  const deckTitle = deckName || `Deck: ${deckId || "Untitled"}`;
  const currencyUsed = currency || "sgd";

  // 🧾 Platform fee (12%)
  const platformFeeAmount = Math.round(priceAmount * 0.12); // 12% of sale price

  try {
    // ✅ Create a checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: currencyUsed,
            unit_amount: priceAmount,
            product_data: {
              name: deckTitle,
            },
          },
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/success?deckId=${encodeURIComponent(
        deckId || ""
      )}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/cancel`,

      // 💸 Route money to seller and keep 12% platform fee
      payment_intent_data: sellerAccountId
        ? {
            application_fee_amount: platformFeeAmount, // your 12% cut
            transfer_data: { destination: sellerAccountId }, // seller’s Stripe account
          }
        : undefined,

      // 🏷️ Metadata (useful for webhooks or records)
      metadata: {
        deckId: deckId || "",
        deckName: deckTitle,
        sellerAccountId: sellerAccountId || "",
      },
    });

    // 🔗 Return the Checkout URL to client
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("❌ Stripe checkout error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
