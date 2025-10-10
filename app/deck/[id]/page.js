"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default function DeckPage() {
  const router = useRouter();
  const { id: deckDocId } = useParams(); // Firestore deck document ID from URL

  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deckName, setDeckName] = useState("(loading...)");

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // Load the real deck name from Firestore
  useEffect(() => {
    async function loadDeck() {
      try {
        const snap = await getDoc(doc(db, "decks", String(deckDocId)));
        const data = snap.exists() ? snap.data() : null;
        setDeckName((data?.name || "Untitled deck").toString());
      } catch {
        setDeckName("Untitled deck");
      }
    }
    if (deckDocId) loadDeck();
  }, [deckDocId]);

  async function handleBuy() {
    if (!user) {
      router.push("/login");
      return;
    }
    if (busy) return;
    setBusy(true);

    try {
      // 1) Ensure Stripe Customer exists (your existing API)
      const customerRes = await fetch("/api/stripe/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, email: user.email }),
      });

      if (!customerRes.ok) {
        console.error("customer error:", await customerRes.text().catch(() => ""));
        alert("Failed to create Stripe customer");
        setBusy(false);
        return;
      }

      const { customerId } = await customerRes.json();
      if (!customerId) {
        alert("No customerId returned");
        setBusy(false);
        return;
      }

      // 2) Create Checkout Session with proper metadata (no hardcoding)
      const checkoutRes = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckDocId,                 // ✅ Firestore deck ID
          deckName,                  // ✅ Human name (for Stripe UI)
          buyerUid: user.uid,        // ✅ Who’s buying
          buyerEmail: user.email,    // ✅ Their email
          customerId,                // optional but you already have it
          // sellerAccountId: "<optional_connect_acct_id>" // include if you have it handy
        }),
      });

      if (!checkoutRes.ok) {
        console.error("checkout error:", await checkoutRes.text().catch(() => ""));
        alert("Failed to start checkout");
        setBusy(false);
        return;
      }

      const { url } = await checkoutRes.json();
      if (!url) {
        alert("Checkout URL missing");
        setBusy(false);
        return;
      }

      // 3) Redirect to Stripe Checkout
      window.location.href = url;
    } catch (e) {
      console.error("buy error:", e);
      alert("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>Deck: {deckName}</h1>
      <p style={{ marginTop: 0, color: "#555" }}>ID: {deckDocId}</p>
      <p>Price: S$5</p>

      <button
        onClick={handleBuy}
        disabled={busy}
        style={{
          padding: "12px 20px",
          fontSize: 16,
          background: busy ? "#94a3b8" : "#2563eb",
          color: "white",
          border: "none",
          borderRadius: 8,
          cursor: busy ? "not-allowed" : "pointer",
        }}
      >
        {user ? (busy ? "Preparing Checkout…" : "Buy Deck – S$5") : "Sign in to Buy"}
      </button>
    </main>
  );
}
