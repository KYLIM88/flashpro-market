// pages/deck/[id].js
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function DeckPage() {
  const router = useRouter();
  const { id } = router.query;

  // Demo deck data
  const [deck, setDeck] = useState({
    name: "Sample Deck",
    price: 500, // cents (S$5.00)
    currency: "sgd",
  });

  useEffect(() => {
    if (id) setDeck((d) => ({ ...d, name: `Deck: ${id}` }));
  }, [id]);

  async function buy() {
    // Try all possible saved keys so it works no matter how /sell saved it
    const sellerAccountId =
      localStorage.getItem("connected_account_id") ||
      localStorage.getItem("stripe_account_id") ||
      localStorage.getItem("seller_account_id") ||
      localStorage.getItem("stripe_connected_account");

    if (!sellerAccountId) {
      alert(
        "No Stripe account found.\n\nDo this:\n1) Open the SAME site where you're testing (/deck) and go to /sell\n2) Click 'Connect payouts with Stripe'\n3) After you return, try Buy again."
      );
      return;
    }

    try {
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckId: id || "demo",
          deckName: deck.name,
          amount: deck.price,
          currency: deck.currency,
          sellerAccountId, // send seller ID to backend
        }),
      });

      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        alert(data?.error || "Checkout creation failed");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Error starting checkout");
    }
  }

  return (
    <main style={{ maxWidth: 680, margin: "40px auto", padding: "0 16px" }}>
      <h1>{deck.name}</h1>
      <p>Price: S${(deck.price / 100).toFixed(2)}</p>
      <button
        onClick={buy}
        style={{
          padding: "12px 18px",
          borderRadius: 8,
          background: "#0070f3",
          color: "white",
          border: "none",
          cursor: "pointer",
        }}
      >
        Buy Deck — S${(deck.price / 100).toFixed(2)}
      </button>
      <p style={{ marginTop: 16, fontSize: 14, opacity: 0.8 }}>
        Test card: 4242 4242 4242 4242 • any future expiry • any CVC • any postal
      </p>
    </main>
  );
}
