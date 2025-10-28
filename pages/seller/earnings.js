import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// ---------- Firebase (client) ----------
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

export default function SellerEarnings() {
  const [uid, setUid] = useState(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) setUid(user.uid);
      else setUid(null);
    });
    return () => unsubAuth();
  }, []);

  if (!uid) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Please log in to view seller information.</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Seller Earnings | FlashPro</title>
      </Head>

      <main
        style={{
          maxWidth: "700px",
          margin: "0 auto",
          padding: "1.5rem",
          fontFamily: "system-ui, Arial, sans-serif",
          background: "#f6f8fb", // ✅ match Sell page background
          minHeight: "100vh",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <h2
            style={{
              fontSize: "1.3rem",
              fontWeight: "600",
              color: "#0f172a",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <span role="img" aria-label="coin">
              💰
            </span>{" "}
            Seller Earnings
          </h2>
          {/* ✅ Fixed Dashboard redirect */}
          <Link href="/">
            <button
              style={{
                background: "#2563eb",
                color: "white",
                padding: "0.5rem 1rem",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              ← Back to Dashboard
            </button>
          </Link>
        </div>

        {/* Info card (Stripe-managed earnings) */}
        <div
          style={{
            background: "white",
            borderRadius: "12px",
            padding: "1.5rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            marginBottom: "1.5rem",
          }}
        >
          <h3 style={{ margin: 0, color: "#0f172a", fontSize: "1.1rem", fontWeight: 700 }}>
            View your earnings in Stripe
          </h3>
          <p style={{ color: "#555", marginTop: "0.5rem", lineHeight: 1.6 }}>
            FlashPro uses <strong>Stripe Connect Standard</strong>, so your payouts, balances,
            and tax documents are managed directly in Stripe. This keeps everything accurate and
            up to date without showing totals inside FlashPro.
          </p>

          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              flexWrap: "wrap",
              marginTop: "0.75rem",
              alignItems: "center",
            }}
          >
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "#0ea5e9",
                color: "white",
                padding: "0.6rem 1rem",
                borderRadius: 8,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Open Stripe Dashboard →
            </a>
            <span style={{ color: "#777", fontSize: "0.9rem" }}>
              Tip: Sign in with the same email you used when connecting your Stripe account.
            </span>
          </div>

          <hr style={{ border: 0, borderTop: "1px solid #eef2f7", margin: "1rem 0" }} />

          <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#555", lineHeight: 1.6 }}>
            <li>Payouts &amp; balance</li>
            <li>Transactions &amp; fees</li>
            <li>Tax forms (when applicable)</li>
          </ul>
        </div>

        {/* (Optional) Help box */}
        <div
          style={{
            background: "white",
            borderRadius: "10px",
            padding: "1rem",
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          }}
        >
          <p style={{ margin: 0, color: "#666", fontSize: "0.95rem" }}>
            Having trouble accessing Stripe? Make sure your seller account is connected on the{" "}
            <Link href="/seller/decks" style={{ color: "#2563eb", fontWeight: 600 }}>
              Sell page
            </Link>
            . If you still can’t sign in, use the{" "}
            <a
              href="https://support.stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#2563eb", fontWeight: 600 }}
            >
              Stripe Support Center
            </a>
            .
          </p>
        </div>
      </main>
    </>
  );
}
