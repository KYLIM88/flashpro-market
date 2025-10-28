// pages/api/sellers/oauth/callback.js
import Stripe from "stripe";

// ---- Firebase Admin (server) ----
// ✅ Use the shared Admin SDK initializer you already have
import { db, initAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// Keep your init semantics (no-op if already initialized)
initAdmin();
// Keep the same variable name used below
const adminDb = db;

// ---- Stripe ----
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

export default async function handler(req, res) {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      console.error("Stripe OAuth error:", error, error_description);
      return res.redirect(`/seller/decks?stripe_error=${encodeURIComponent(error)}`);
    }
    if (!code || !state) {
      return res.redirect(`/seller/decks?stripe_error=missing_code_or_state`);
    }

    // Exchange short-lived auth code for tokens
    const token = await stripe.oauth.token({
      grant_type: "authorization_code",
      code,
    });
    const connectedAccountId = token.stripe_user_id; // e.g., "acct_123..."

    if (!connectedAccountId) {
      return res.redirect(`/seller/decks?stripe_error=no_connected_account`);
    }

    const uid = String(state); // we sent user.uid in the "state" param

    // Write to Firestore: users/{uid}
    await adminDb.collection("users").doc(uid).set(
      {
        stripeAccountId: connectedAccountId,
        stripeConnectedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Done: back to Sell page
    return res.redirect(`/seller/decks?connected=1`);
  } catch (err) {
    console.error("OAuth callback failed:", err);
    const msg = err?.message || "callback_failed";
    return res.redirect(`/seller/decks?stripe_error=${encodeURIComponent(msg)}`);
  }
}

// Disable body parsing for safety (not strictly required here)
export const config = {
  api: { bodyParser: true },
};
