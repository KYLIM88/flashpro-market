// app/api/checkout/route.js
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin"; // Firestore Admin (service account / Vercel env)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

/** Convert price like "4.90" or 4.9 or 5 -> integer cents */
function toCents(val) {
  const n = Number(val);
  if (!isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

/** Read cents from listing supporting multiple shapes */
function getUnitAmountFromListing(listing) {
  // Prefer explicit cents fields if present
  const centsCandidates = [
    listing?.priceCents,
    listing?.price_cents,
    listing?.priceCentsSGD,
  ].map((v) => (v == null ? null : Number(v)));

  for (const v of centsCandidates) {
    if (Number.isFinite(v) && v > 0) return Math.round(v);
  }

  // Fallback: dollars field -> cents
  const dollars = listing?.price;
  const centsFromDollars = toCents(dollars);
  if (centsFromDollars > 0) return centsFromDollars;

  return 0;
}

export async function POST(req) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }

    // ---- parse body safely ----
    const body = await req.json().catch(() => ({}));
    const {
      listingId: listingIdFromBody,
      buyerUid,
      buyerEmail,
      deckId: deckIdHint,
      deckId,
    } = body || {};

    let listingId = listingIdFromBody || null;

    // ---- load listing (server-trust) ----
    let listingSnap;
    if (listingId) {
      listingSnap = await db.collection("listings").doc(listingId).get();
      if (!listingSnap.exists) {
        return NextResponse.json({ error: "Listing not found" }, { status: 404 });
      }
    } else {
      // No listingId provided: fall back to deckId search (active listing)
      const deckIdSearch = deckIdHint || deckId;
      if (!deckIdSearch) {
        return NextResponse.json(
          { error: "Missing fields: need listingId OR deckId" },
          { status: 400 }
        );
      }
      const q = await db
        .collection("listings")
        .where("deckId", "==", deckIdSearch)
        .where("status", "==", "active")
        .limit(1)
        .get();
      if (q.empty) {
        return NextResponse.json(
          { error: "No active listing for this deck" },
          { status: 404 }
        );
      }
      listingSnap = q.docs[0];
      listingId = listingSnap.id;
    }

    const listing = listingSnap.data();
    if (listing.status !== "active") {
      return NextResponse.json({ error: "Listing is not active" }, { status: 400 });
    }

    const { title, deckId: deckIdFromListing, sellerUid } = listing || {};
    if (!deckIdFromListing || !sellerUid) {
      return NextResponse.json({ error: "Listing missing fields" }, { status: 400 });
    }

    // Optional sanity check if client also sent deckId
    const deckIdClient = deckIdHint || deckId;
    if (deckIdClient && deckIdClient !== deckIdFromListing) {
      return NextResponse.json({ error: "Listing/deck mismatch" }, { status: 400 });
    }

    // ---- get seller's connected Stripe account ----
    const sellerSnap = await db.collection("users").doc(sellerUid).get();
    const seller = sellerSnap.exists ? sellerSnap.data() : null;
    const sellerAccountId = seller?.stripeAccountId;
    if (!sellerAccountId) {
      return NextResponse.json(
        { error: "Seller not connected to Stripe (no stripeAccountId)" },
        { status: 400 }
      );
    }

    // ---- compute amounts (accept dollars or cents) ----
    const unitAmount = getUnitAmountFromListing(listing); // in cents
    if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid price on listing (set price or priceCents)" },
        { status: 400 }
      );
    }
    const platformFee = Math.round(unitAmount * 0.12); // 12% platform fee

    // ---- URLs (work in dev + prod) ----
    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    // ======================================================
    // ✅ DIRECT CHARGES IMPLEMENTATION
    // ======================================================
    // The checkout session is created *on the connected account*
    // Stripe fees, disputes, and refunds belong to that account.
    // The platform still collects 12% via application_fee_amount.
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        ...(buyerEmail ? { customer_email: buyerEmail } : {}),
        line_items: [
          {
            price_data: {
              currency: "sgd",
              product_data: { name: title || "FlashPro Deck" },
              unit_amount: unitAmount,
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/checkout/cancel`,
        metadata: {
          listingId,
          deckId: deckIdFromListing,
          sellerUid,
          ...(buyerUid ? { buyerUid } : {}),
          ...(buyerEmail ? { buyerEmail } : {}),
        },
        payment_intent_data: {
          application_fee_amount: platformFee,
          // NOTE: no transfer_data for direct charges
          on_behalf_of: sellerAccountId,
        },
      },
      { stripeAccount: sellerAccountId } // <- Direct charge: created on connected account
    );

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    console.error("[/app/api/checkout] error:", err);
    return NextResponse.json(
      { error: err?.message || "Checkout error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Use POST" }, { status: 405 });
}
