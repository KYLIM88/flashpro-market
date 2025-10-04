import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function DeckPage() {
  const router = useRouter();
  const { id } = router.query;

  // Demo deck data
  const [deck, setDeck] = useState({
    name: "Sample Deck",
    price: 500,      // cents (S$5.00)
    currency: "sgd",
  });

  useEffect(() => {
    if (id) setDeck((d) => ({ ...d, name: `Deck: ${id}` }));
  }, [id]);

  async function buy() {
    const sellerAccountId = localStorage.getItem("stripe_account_id");
    if (!sellerAccountId) {
      alert("Please connect a Stripe account first on /sell.");
      return;
    }
    const res = await fetch("/api/checkout/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deckId: id || "demo",
        deckName: deck.name,
        amount: deck.price,
        currency: deck.currency,
        sellerAccountId,
      }),
    });
    const data = await res.json();
    if (data?.url) window.location = data.url;
    else alert(data?.error || "Checkout creation failed");
  }

  return (
    <main style={{ maxWidth: 680, margin: "40px auto", padding: "0 16px" }}>
      <h1>{deck.name}</h1>
      <p>Price: S${(deck.price / 100).toFixed(2)}</p>
      <button onClick={buy} style={{ padding: "12px 18px", borderRadius: 8 }}>
        Buy Deck — S${(deck.price / 100).toFixed(2)}
      </button>
      <p style={{ marginTop: 16, fontSize: 14, opacity: 0.8 }}>
        Test card: 4242 4242 4242 4242 • any future expiry • any CVC • any postal
      </p>
    </main>
  );
}
