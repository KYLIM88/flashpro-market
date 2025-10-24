// app/api/stripe/webhook/route.js
import Stripe from "stripe";
import { adminDb } from "@/lib/firebaseAdmin"; // ✅ uses Admin SDK (bypasses rules)
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Allow multiple signing secrets, comma-separated (platform,connected)
function getSecrets() {
  const raw = process.env.STRIPE_WEBHOOK_SECRET || "";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function GET() {
  return new Response("✅ Webhook endpoint is alive", { status: 200 });
}

export async function POST(req) {
  try {
    const rawBody = await req.text();
    const sig = req.headers.get("stripe-signature");
    const secrets = getSecrets();

    if (!sig || secrets.length === 0) {
      console.error("❌ Missing Stripe signature or webhook secret(s)");
      return new Response("Missing signature or secret", { status: 400 });
    }

    // Try each secret until one verifies (supports “Your account” + “Connected/v2 accounts”)
    let event = null;
    let lastErr = null;
    for (const secret of secrets) {
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, secret);
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!event) {
      console.error("❌ Signature verification failed for all secrets:", lastErr?.message);
      return new Response(`Webhook Error: ${lastErr?.message || "bad signature"}`, { status: 400 });
    }

    console.log("✅ Stripe event verified:", event.type);

    if (event.type === "checkout.session.completed") {
      const s = event.data.object;
      const md = s?.metadata || {};

      // ✅ NEW canonical fields with backward-compat fallbacks
      const deckDocId   = md.deckDocId || md.deckId || null;           // Firestore deck document ID
      const deckName    = md.deckName  || null;
      const buyerUid    = md.buyerUid  || md.uid || null;
      const buyerEmail  = md.buyerEmail || s?.customer_details?.email || null;
      const sellerAccountId = md.sellerAccountId || "";

      console.log("🧾 checkout.session.completed payload:", {
        sessionId: s.id, buyerEmail, deckDocId, buyerUid, sellerAccountId
      });

      if (!buyerEmail || !deckDocId) {
        console.warn("⚠️ Missing buyerEmail or deckDocId — skipping save");
        return new Response("ok", { status: 200 });
        // (Do not throw; we don't want Stripe to retry forever on metadata mistakes.)
      }

      // Save canonical purchase row (what your client reads)
      await adminDb.collection("purchases").add({
        buyerEmail,
        buyerUid: buyerUid || null,
        deckId: deckDocId,                 // ✅ store the real Firestore deck ID
        deckName: deckName || null,
        sellerAccountId,
        stripeSessionId: s.id,
        amount_total: s.amount_total ?? null,
        currency: s.currency ?? "sgd",
        createdAt: FieldValue.serverTimestamp(),
        source: "stripe",
      });

      // Write an index doc for hardened rules later: purchasesIndex/{buyerUid__deckDocId}
      if (buyerUid) {
        const idxId = `${buyerUid}__${deckDocId}`;
        await adminDb.doc(`purchasesIndex/${idxId}`).set({
          buyerUid,
          deckId: deckDocId,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      console.log(`📝 Saved purchase → ${buyerEmail} owns deck ${deckDocId}`);
    } else {
      console.log("ℹ️ Unhandled event type:", event.type);
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("❌ Webhook handler failed:", err);
    return new Response("Webhook handler failed", { status: 500 });
  }
}
