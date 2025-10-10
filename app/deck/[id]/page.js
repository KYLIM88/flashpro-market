"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebaseClient";
import { onAuthStateChanged } from "firebase/auth";

export default function DeckPage() {
  const router = useRouter();
  const { id: deckId } = useParams();
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  async function handleBuy() {
    if (!user) {
      router.push("/login");
      return;
    }
    if (busy) return;
    setBusy(true);

    try {
      // 1) Ensure Stripe customer exists
      const customerRes = await fetch("/api/stripe/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, email: user.email }),
      });
      if (!customerRes.ok) {
        const t = await customerRes.text().catch(() => "");
        console.error("customer error:", t);
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

      // 2) Create checkout session
      const checkoutRes = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId, uid: user.uid, customerId }),
      });
      if (!checkoutRes.ok) {
        const t = await checkoutRes.text().catch(() => "");
        console.error("checkout error:", t);
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

      // 3) Redirect
      window.location.href = url;
    } catch (e) {
      console.error("buy error:", e);
      alert("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <h1>Deck #{deckId}</h1>
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
