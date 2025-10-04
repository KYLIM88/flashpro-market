import { useEffect, useState } from "react";
import Head from "next/head";

const authBase = "https://connect.stripe.com/oauth/authorize";

export default function Sell() {
  const [acct, setAcct] = useState(null);

  // Load from localStorage when page loads
  useEffect(() => {
    const stored = localStorage.getItem("stripe_account_id");
    if (stored) setAcct(stored);
  }, []);

  const clientId = process.env.NEXT_PUBLIC_STRIPE_CONNECT_CLIENT_ID;
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const redirect = `${site}/api/sellers/oauth/callback`;

  const connectUrl = `${authBase}?response_type=code&client_id=${encodeURIComponent(
    clientId || ""
  )}&scope=read_write&redirect_uri=${encodeURIComponent(redirect)}`;

  return (
    <>
      <Head>
        <title>Sell on FlashPro</title>
      </Head>
      <main style={{ maxWidth: 680, margin: "40px auto", padding: "0 16px" }}>
        <h1>Sell on FlashPro Marketplace</h1>
        <p>Connect your Stripe account to receive payouts from your deck sales.</p>

        {acct ? (
          <div
            style={{
              background: "#ecfdf5",
              border: "1px solid #10b981",
              padding: "12px 16px",
              borderRadius: 8,
              marginTop: 16,
            }}
          >
            ✅ Connected to Stripe<br />
            <strong>Account ID:</strong> {acct}
          </div>
        ) : !clientId ? (
          <div
            style={{
              padding: "12px 16px",
              border: "1px solid #f0b429",
              background: "#fff8e1",
              borderRadius: 8,
              margin: "16px 0",
            }}
          >
            <strong>Setup needed:</strong> Add{" "}
            <code>NEXT_PUBLIC_STRIPE_CONNECT_CLIENT_ID</code> to your{" "}
            <code>.env.local</code> and restart <code>npm run dev</code>.
          </div>
        ) : (
          <a
            href={connectUrl}
            style={{
              display: "inline-block",
              padding: "12px 18px",
              borderRadius: 8,
              textDecoration: "none",
              border: "1px solid #ccc",
              marginTop: 16,
            }}
          >
            🔗 Connect payouts with Stripe
          </a>
        )}

        <hr style={{ margin: "24px 0" }} />

        <p style={{ fontSize: 14, opacity: 0.8 }}>
          This uses{" "}
          <a href="https://stripe.com/connect" target="_blank" rel="noreferrer">
            Stripe Connect Standard
          </a>
          . After you connect, your payouts will go directly to your Stripe account.
        </p>
      </main>
    </>
  );
}
