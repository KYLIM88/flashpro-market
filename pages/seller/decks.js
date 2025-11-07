// pages/seller/decks.js
import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

// ---------- Firebase (env-based) ----------
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- Helpers ----------
function cents(n) {
  return Math.round(Number(n) * 100);
}
function money(centsVal, currency = "SGD") {
  try {
    return new Intl.NumberFormat("en-SG", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format((centsVal || 0) / 100);
  } catch {
    return `S$${((centsVal || 0) / 100).toFixed(2)}`;
  }
}
function estimateNet(priceCents) {
  const stripePct = 0.034; // 3.4%
  const stripeFixed = 50; // S$0.50
  const platformPct = 0.12; // 12%
  const platformFee = Math.round(priceCents * platformPct);
  const stripeFee = Math.round(priceCents * stripePct) + stripeFixed;
  const net = priceCents - platformFee - stripeFee;
  return { net, platformFee, stripeFee };
}

// ---------- Page ----------
export default function SellDecksPage() {
  const [user, setUser] = useState(null);
  const [seller, setSeller] = useState(null);
  const [decks, setDecks] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [priceMap, setPriceMap] = useState({});
  const [listingsMap, setListingsMap] = useState({});

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // ✅ Load seller profile and check Stripe status
  useEffect(() => {
    if (!user?.uid) return;
    const userRef = doc(db, "users", user.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setSeller({
          ...snap.data(),
          stripeConnected: !!snap.data().stripeAccountId,
        });
      }
    });
    return () => unsub();
  }, [user?.uid]);

  // Load my decks
  useEffect(() => {
    if (!user?.uid) return;
    const qDecks = query(
      collection(db, "decks"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      qDecks,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setDecks(rows);
      },
      (err) => {
        console.error("Failed to load decks", err);
        alert("Failed to load your decks. Check Firestore rules.");
      }
    );
    return () => unsub();
  }, [user?.uid]);

  // Load my listings
  useEffect(() => {
    if (!user?.uid) return;
    const qList = query(
      collection(db, "listings"),
      where("sellerUid", "==", user.uid)
    );
    const unsub = onSnapshot(
      qList,
      (snap) => {
        const map = {};
        snap.docs.forEach((d) => {
          const li = { id: d.id, ...d.data() };
          map[li.deckId] = li;
        });
        setListingsMap(map);
      },
      (err) => console.error("Failed to load listings", err)
    );
    return () => unsub();
  }, [user?.uid]);

  // Publish
  async function publish(deck) {
    if (!user) return;
    if (!seller?.stripeConnected) {
      alert("⚠️ You must connect your Stripe account before publishing.");
      return;
    }

    const deckId = deck.id;
    const id = `${user.uid}__${deckId}`;
    const ref = doc(db, "listings", id);

    let priceCentsVal = null;
    const input = (priceMap[deckId] ?? "").trim();
    if (input) {
      const n = Number(input);
      if (isNaN(n) || n <= 0) return alert("Price must be a positive number.");
      priceCentsVal = cents(n);
    } else if (listingsMap[deckId]?.priceCents) {
      priceCentsVal = listingsMap[deckId].priceCents;
    } else {
      return alert("Add a price before publishing.");
    }

    try {
      setBusyId(deckId);
      if (!listingsMap[deckId]) {
        const deckSnap = await getDoc(doc(db, "decks", deckId));
        const deckData = deckSnap.exists() ? deckSnap.data() : deck;
        await setDoc(
          ref,
          {
            listingId: id,
            deckId,
            sellerUid: user.uid,
            sellerEmail: user.email || null,
            title: deckData?.name || deckData?.title || "Untitled Deck",
            subjectId: deckData?.subjectId || null,
            preview: {
              cardCount: deckData?.cardCount ?? null,
              coverEmoji: deckData?.icon || "📚",
            },
            currency: "SGD",
            priceCents: priceCentsVal,
            status: "draft",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        await updateDoc(ref, {
          priceCents: priceCentsVal,
          updatedAt: serverTimestamp(),
        });
      }

      await updateDoc(ref, {
        status: "active",
        updatedAt: serverTimestamp(),
      });

      setBusyId(null);
      alert("Listing published ✅ (now visible on Marketplace).");
    } catch (e) {
      console.error(e);
      setBusyId(null);
      alert("Failed to publish listing.");
    }
  }

  // Unpublish
  async function unpublish(deckId) {
    if (!user) return;
    try {
      setBusyId(deckId);
      const id = `${user.uid}__${deckId}`;
      const ref = doc(db, "listings", id);
      await updateDoc(ref, { status: "draft", updatedAt: serverTimestamp() });
      setBusyId(null);
      alert("Listing unpublished (back to draft).");
    } catch (e) {
      console.error(e);
      setBusyId(null);
      alert("Failed to unpublish listing.");
    }
  }

  // Header
  const headerRight = useMemo(() => {
    if (!user)
      return (
        <Link href="/login" className="btn primary">
          Login
        </Link>
      );
    return (
      <div className="profile">
        <div className="avatar">
          {user.email?.[0]?.toUpperCase() || "U"}
        </div>
        <div className="info">
          <span className="email">{user.email}</span>
          <button className="link" onClick={() => signOut(auth)}>
            Logout
          </button>
        </div>
      </div>
    );
  }, [user]);

  return (
    <>
      <Head>
        <title>FlashPro — Sell Decks</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container">
        <header className="topbar">
          <div className="left-side">
            <Link href="/" className="btn back-btn">← Back to Dashboard</Link>
          </div>
          <div className="brand">
            <span className="logo">📚</span>
            <h1>Sell Decks</h1>
          </div>
          <div className="right-side">{headerRight}</div>
        </header>

        {!user && (
          <section className="notice">
            <p>Please login to see your decks.</p>
          </section>
        )}

        {user && (
          <>
            {/* ✅ Stripe Connect Section */}
            <section className="welcome">
              <h2>Your decks</h2>
              <p className="muted">
                Enter a <b>price</b>. Tap <b>Publish</b> to list on the
                Marketplace. Unpublish anytime to edit the price.
              </p>

              {!seller?.stripeConnected ? (
                <div style={{ marginTop: "8px" }}>
                  <p style={{ color: "#b91c1c", fontWeight: "600" }}>
                    ⚠️ You must connect your Stripe account before publishing.
                  </p>
                  <button
                    className="btn primary"
                    style={{ marginTop: "8px" }}
                    onClick={() => {
                      const clientId =
                        process.env.NEXT_PUBLIC_STRIPE_CONNECT_CLIENT_ID;
                      const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/sellers/oauth/callback`;
                      const url =
                        `https://connect.stripe.com/oauth/authorize?response_type=code` +
                        `&client_id=${clientId}` +
                        `&scope=read_write` +
                        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
                        `&state=${user?.uid || ""}`;
                      window.location.href = url;
                    }}
                  >
                    🔗 Connect Stripe Account
                  </button>
                </div>
              ) : (
                <p style={{ color: "#166534", fontWeight: "600" }}>
                  ✅ Stripe account connected — you can publish decks.
                </p>
              )}
            </section>

            {/* ✅ Deck list */}
            <section className="list">
              {decks.length === 0 && (
                <div className="empty">
                  <p>
                    No decks yet. Create decks in the FlashPro app, then come
                    back here to list them for sale.
                  </p>
                  <Link href="/" className="btn">
                    ← Back to Dashboard
                  </Link>
                </div>
              )}
              {decks.map((deck) => {
                const title = deck.name || deck.title || "Untitled Deck";
                const emoji = deck.icon || "📘";
                const deckId = deck.id;
                const listing = listingsMap[deckId];
                const status = listing?.status || "none";

                const inputStr =
                  priceMap[deckId] ??
                  (listing?.priceCents
                    ? (listing.priceCents / 100).toFixed(2)
                    : "");
                const previewPriceCents = inputStr
                  ? cents(inputStr)
                  : listing?.priceCents || 0;
                const { net, platformFee, stripeFee } =
                  estimateNet(previewPriceCents);

                return (
                  <div key={deckId} className="row">
                    <div className="row-head">
                      <div className="deck">
                        <div className="deck-icon">{emoji}</div>
                        <div className="deck-info">
                          <h3 className="deck-title">{title}</h3>
                          <div className="deck-meta">
                            <span className={`status ${status}`}>{status}</span>
                            <span className="dot">•</span>
                            <span className="muted">ID: {deckId}</span>
                          </div>
                        </div>
                      </div>
                      <Link href={`/deck/${deckId}`} className="link small">
                        View in app
                      </Link>
                    </div>

                    <div className="row-actions">
                      <div className="price-box">
                        <label htmlFor={`price-${deckId}`}>Price (SGD)</label>
                        <input
                          id={`price-${deckId}`}
                          inputMode="decimal"
                          placeholder="e.g., 4.90"
                          value={inputStr}
                          disabled={listing?.status === "active"}
                          onChange={(e) =>
                            setPriceMap((m) => ({
                              ...m,
                              [deckId]: e.target.value,
                            }))
                          }
                        />
                        {listing?.status === "active" && (
                          <small className="muted">
                            Unpublish to change price.
                          </small>
                        )}
                      </div>

                      <div className="est">
                        <div className="pill">
                          <span className="pill-k">Buyer pays</span>
                          <span className="pill-v">
                            {money(previewPriceCents)}
                          </span>
                        </div>
                        <div className="pill">
                          <span className="pill-k">Fees (est.)</span>
                          <span className="pill-v">
                            −{" "}
                            {money(
                              platformFee + stripeFee > 0
                                ? platformFee + stripeFee
                                : 0
                            )}
                          </span>
                        </div>
                        <div className="pill strong">
                          <span className="pill-k">You receive</span>
                          <span className="pill-v">
                            {money(net > 0 ? net : 0)}
                          </span>
                        </div>
                      </div>

                      <div className="actions">
                        {status === "active" ? (
                          <button
                            className="btn outline"
                            disabled={busyId === deckId}
                            onClick={() => unpublish(deckId)}
                          >
                            {busyId === deckId ? "Unpublishing…" : "Unpublish"}
                          </button>
                        ) : (
                          <button
                            className="btn primary"
                            disabled={busyId === deckId}
                            onClick={() => publish(deck)}
                          >
                            {busyId === deckId ? "Publishing…" : "Publish"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          </>
        )}

        <footer className="footer">
          <p className="muted">© {new Date().getFullYear()} FlashPro</p>
        </footer>
      </main>

      {/* Styles unchanged (with input visibility + CSS fix) */}
      <style jsx global>{`
        :root {
          --bg: #f6f8fb;
          --surface: #ffffff;
          --text: #0f172a;
          --muted: #64748b;
          --border: #e2e8f0;
          --shadow: 0 8px 24px rgba(2, 6, 23, 0.06);
          --primary: #2563eb;
          --primary-weak: #60a5fa;
        }
        * {
          box-sizing: border-box;
        }
        html,
        body,
        #__next {
          height: 100%;
        }
        body {
          margin: 0;
          background: var(--bg);
          color: var(--text);
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI,
            Roboto, Helvetica, Arial;
        }
        a {
          text-decoration: none;
          color: inherit;
        }
        .container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 16px;
        }
        .topbar {
          position: sticky;
          top: 0;
          z-index: 20;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 12px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          padding: 12px 8px;
        }
        .left-side {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          justify-self: center;
        }
        .brand h1 {
          margin: 0;
          font-size: 18px;
          color: var(--primary);
          font-weight: 800;
          letter-spacing: 0.2px;
        }
        .logo {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          border-radius: 12px;
          background: linear-gradient(
            135deg,
            var(--primary-weak),
            var(--primary)
          );
          color: #fff;
          font-weight: 900;
          box-shadow: var(--shadow);
        }
        .right-side {
          display: flex;
          align-items: center;
          gap: 12px;
          justify-content: flex-end;
        }
        .profile {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: var(--primary);
          color: #fff;
          font-weight: 800;
          box-shadow: var(--shadow);
        }
        .info {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          line-height: 1.1;
        }
        .email {
          font-size: 13px;
          color: var(--muted);
        }
        .link {
          border: none;
          background: none;
          color: var(--primary);
          padding: 0;
          font-size: 12px;
          cursor: pointer;
        }
        .link.small {
          font-size: 12px;
          color: var(--primary);
        }
        .welcome {
          margin: 18px 2px;
        }
        .welcome h2 {
          margin: 0 0 4px;
          font-size: 24px;
        }
        .muted {
          color: var(--muted);
        }
        .notice {
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 14px;
          box-shadow: var(--shadow);
          margin-top: 14px;
        }
        .list {
          display: grid;
          gap: 12px;
          margin-top: 8px;
        }
        .row {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px; /* ✅ fixed stray line */
          box-shadow: var(--shadow);
          padding: 14px;
          display: grid;
          gap: 12px;
        }
        .row-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }
        .deck {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .deck-icon {
          font-size: 24px;
        }
        .deck-info {
          display: grid;
        }
        .deck-title {
          margin: 0;
          font-size: 16px;
        }
        .deck-meta {
          display: flex;
          gap: 6px;
          color: var(--muted);
          font-size: 12px;
        }
        .status {
          padding: 3px 8px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: #f8fafc;
        }
        .status.active {
          background: #ecfdf5;
          border-color: #bbf7d0;
          color: #166534;
        }
        .status.draft {
          background: #f1f5f9;
          border-color: #e2e8f0;
          color: #334155;
        }
        .status.none {
          background: #fff;
          border-color: #e2e8f0;
          color: #64748b;
        }
        .dot {
          opacity: 0.6;
        }
        .row-actions {
          display: grid;
          gap: 10px;
        }
        @media (min-width: 640px) {
          .row-actions {
            grid-template-columns: 220px 1fr auto;
            align-items: end;
          }
        }
        .price-box {
          display: grid;
          gap: 6px;
        }
        .price-box label {
          font-size: 12px;
          color: var(--muted);
        }
        .price-box input {
          height: 40px;
          border-radius: 12px;
          border: 1px solid var(--border);
          padding: 0 12px;
          background: #fff;
          color: var(--text);       /* ✅ visible input text */
          font-weight: 500;
          outline: none;
        }
        .price-box input::placeholder {
          color: #94a3b8;           /* ✅ softer placeholder */
        }
        .price-box input:focus {
          border-color: #cbd5e1;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
        }
        .est {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .pill {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f8fafc;
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          color: var(--muted);
        }
        .pill.strong {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1e3a8a;
        }
        .pill-k {
          opacity: 0.9;
        }
        .pill-v {
          font-weight: 700;
          color: #0f172a;
        }
        .actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-start;
        }
        .btn {
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid var(--border);
          font-weight: 600;
          background: #fff;
          min-width: 120px;
        }
        .btn.primary {
          background: var(--primary);
          color: #fff;
          border-color: transparent;
          box-shadow: 0 6px 18px rgba(37, 99, 235, 0.18);
        }
        .btn.outline {
          background: #fff;
          color: #0f172a;
          border-color: #cbd5e1;
        }
        .btn.outline:hover {
          border-color: #94a3b8;
        }
        .btn:disabled {
          opacity: 0.6;
        }
        .back-btn {
          min-width: unset;
          padding: 8px 12px;
          border-radius: 10px;
        }
        .empty {
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 16px;
          box-shadow: var(--shadow);
          padding: 16px;
          text-align: center;
          display: grid;
          gap: 10px;
        }
        .footer {
          text-align: center;
          margin: 24px 0 12px;
        }
      `}</style>
    </>
  );
}
