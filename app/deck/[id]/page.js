"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebaseClient";      // ✅ use ready-made auth
import { onAuthStateChanged } from "firebase/auth";

export default function DeckPage() {
  const router = useRouter();
  const { id: deckId } = useParams();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  async function handleBuy() {
    if (!user) { router.push("/login"); return; }

    try {
      const customerRes = await fetch("/api/stripe/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, email: user.email }),
      });
      const { customerId } = await customerRes.json();
      if (!customerId) { alert("Failed to create Stripe customer"); return; }

      const checkoutRes = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId, uid: user.uid, customerId }),
      });
      const { url } = await checkoutRes.json();
      if (!url) { alert("Failed to start checkout"); return; }
      window.location.href = url;
    } catch (e) {
      console.error(e);
      alert("Something went wrong, please try again.");
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <h1>Deck #{deckId}</h1>
      <p>Price: S$5</p>
      <button
        onClick={handleBuy}
        style={{ padding: "12px 20px", fontSize: 16, background: "#2563eb", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
      >
        {user ? "Buy Deck – S$5" : "Sign in to Buy"}
      </button>
    </main>
  );
}
