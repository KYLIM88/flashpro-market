// pages/market.js
import Head from "next/head";
import Link from "next/link";
import Router from "next/router";
import { useEffect, useMemo, useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
} from "firebase/firestore";

// Firebase (env)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// helpers
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
function maskEmail(email = "") {
  const [name, domain] = String(email).split("@");
  if (!domain) return email;
  const head = name.slice(0, 2);
  const tail = name.length > 4 ? "…" : "";
  return `${head}${tail}@${domain}`;
}

// check purchasesIndex in both key orders
async function hasPurchase(uid, deckId) {
  if (!uid || !deckId) return false;
  const A = await getDoc(doc(db, "purchasesIndex", `${uid}__${deckId}`));
  if (A.exists()) return true;
  const B = await getDoc(doc(db, "purchasesIndex", `${deckId}__${uid}`));
  return B.exists();
}

// render stars from average (0–5)
function Stars({ value }) {
  const n = Math.round(Number(value) || 0);
  const full = "★★★★★".slice(0, n);
  const empty = "☆☆☆☆☆".slice(0, 5 - n);
  return (
    <span className="stars" title={`${value || 0} out of 5`}>
      {full}
      {empty}
    </span>
  );
}

export default function MarketPage() {
  const [user, setUser] = useState(null);
  const [rows, setRows] = useState([]);
  const [qText, setQText] = useState("");
  const [buyingId, setBuyingId] = useState(null);

  // which deckIds are already owned (via purchase)
  const [ownedDeckIds, setOwnedDeckIds] = useState(new Set());
  const [checkingOwned, setCheckingOwned] = useState(false);

  // live average ratings: { [deckId]: { avg, count } }
  const [ratings, setRatings] = useState({});

  // ✅ cover cache: { [deckId]: coverUrl|null }
  const [coversByDeck, setCoversByDeck] = useState({});

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // load active listings
  useEffect(() => {
    const qRef = query(
      collection(db, "listings"),
      where("status", "==", "active")
    );
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => {
          const ta = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
          const tb = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
          return tb - ta;
        });
        setRows(data);
      },
      (err) => {
        console.error("Failed to load listings", err);
        alert("Failed to load marketplace listings. Check your Firestore rules.");
      }
    );
    return () => unsub();
  }, []);

  // check ownership for visible deckIds (purchases-based)
  useEffect(() => {
    let cancelled = false;

    async function checkOwned() {
      if (!user || rows.length === 0) {
        setOwnedDeckIds(new Set());
        return;
      }
      const deckIds = Array.from(
        new Set(rows.map((r) => r.deckId).filter(Boolean))
      );
      if (deckIds.length === 0) {
        setOwnedDeckIds(new Set());
        return;
      }

      setCheckingOwned(true);
      try {
        const pairs = await Promise.all(
          deckIds.map(async (deckId) => [deckId, await hasPurchase(user.uid, deckId)])
        );
        if (cancelled) return;
        const owned = new Set(pairs.filter(([, ok]) => ok).map(([id]) => id));
        setOwnedDeckIds(owned);
      } finally {
        if (!cancelled) setCheckingOwned(false);
      }
    }

    checkOwned();
    return () => {
      cancelled = true;
    };
  }, [user, rows]);

  // 🔴 live review averages per deckId
  useEffect(() => {
    const deckIds = Array.from(new Set(rows.map((r) => r.deckId).filter(Boolean)));
    if (deckIds.length === 0) return;

    const unsubs = deckIds.map((deckId) =>
      onSnapshot(
        collection(db, "decks", String(deckId), "reviews"),
        (snap) => {
          const vals = snap.docs.map((d) => d.data());
          const count = vals.length;
          const avg = count
            ? Math.round(
                (vals.reduce((a, r) => a + (Number(r.rating) || 0), 0) / count) * 10
              ) / 10
            : 0;
          setRatings((prev) => ({ ...prev, [deckId]: { avg, count } }));
        },
        (err) => {
          console.warn("reviews average load failed for deck", deckId, err);
          setRatings((prev) => ({ ...prev, [deckId]: { avg: 0, count: 0 } }));
        }
      )
    );

    return () => unsubs.forEach((u) => u && u());
  }, [rows]);

  // ✅ fetch coverUrl for any deck we don't have yet
  useEffect(() => {
    if (!rows.length) return;
    let cancelled = false;

    (async () => {
      const needed = Array.from(
        new Set(
          rows
            .map((r) => String(r.deckId))
            .filter((id) => id && !(id in coversByDeck))
        )
      );
      if (!needed.length) return;

      try {
        const pairs = await Promise.all(
          needed.map(async (deckId) => {
            try {
              const snap = await getDoc(doc(db, "decks", deckId));
              const url = snap.exists() ? snap.data()?.coverUrl || null : null;
              return [deckId, url];
            } catch (e) {
              console.warn("cover load failed for deck", deckId, e);
              return [deckId, null];
            }
          })
        );
        if (!cancelled) {
          setCoversByDeck((prev) => {
            const next = { ...prev };
            for (const [deckId, url] of pairs) next[deckId] = url;
            return next;
          });
        }
      } catch (e) {
        console.error("batch cover load", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rows, coversByDeck]);

  const headerRight = useMemo(() => {
    if (!user) return <Link href="/login" className="btn primary">Login</Link>;
    return (
      <div className="profile">
        <div className="avatar">{user.email?.[0]?.toUpperCase() || "U"}</div>
        <div className="info">
          <span className="email">{user.email}</span>
          <button className="link" onClick={() => signOut(auth)}>Logout</button>
        </div>
      </div>
    );
  }, [user]);

  const filtered = rows.filter((r) => {
    const t = (r.title || "").toLowerCase();
    const s = (qText || "").toLowerCase();
    return !s || t.includes(s);
  });

  // (kept for parity; no longer used for the button since it links to /deck/[id])
  async function handleBuy(listing) {
    try {
      if (!user) {
        Router.push("/login");
        return;
      }
      const isSeller =
        listing?.sellerUid && user?.uid && listing.sellerUid === user.uid;
      if (listing.deckId && (ownedDeckIds.has(listing.deckId) || isSeller)) {
        alert(isSeller ? "This is your deck." : "You already own this deck.");
        return;
      }
      setBuyingId(listing.id);
      const payload = {
        listingId: listing.id,
        buyerUid: user.uid,
        buyerEmail: user.email,
        deckId: listing.deckId || undefined,
      };
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let data;
      try {
        data = await res.clone().json();
      } catch {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (!data?.url) throw new Error("No checkout URL returned.");
      window.location.href = data.url;
    } catch (e) {
      console.error("Buy error:", e);
      alert(e.message || "Failed to start checkout");
      setBuyingId(null);
    }
  }

  return (
    <>
      <Head>
        <title>FlashPro — Marketplace</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container">
        <header className="topbar">
          <div className="left-side">
            <Link href="/" className="btn back-btn">← Back to Dashboard</Link>
          </div>
          <div className="brand">
            <span className="logo">🛒</span>
            <h1>Marketplace</h1>
          </div>
          <div className="right-side">{headerRight}</div>
        </header>

        <section className="filters">
          <input
            placeholder="Search decks (e.g., Biology, Marketing)…"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
          />
        </section>

        <section className="grid">
          {filtered.length === 0 && (
            <div className="empty">
              <p>No listings yet. Check back soon!</p>
              <Link href="/seller/decks" className="btn">
                List your first deck →
              </Link>
            </div>
          )}

          {filtered.map((item) => {
            const emoji = item.preview?.coverEmoji || "📚";
            const title = item.title || "Untitled Deck";
            const count = item.preview?.cardCount;
            const priceCents =
              item.priceCents ?? item.price_cents ?? item.priceCentsSGD ?? 0;

            // ✅ treat seller as owner too
            const isSeller = !!(user && item.sellerUid && item.sellerUid === user.uid);
            const isOwnedByPurchase = !!(user && item.deckId && ownedDeckIds.has(item.deckId));
            const isOwned = isSeller || isOwnedByPurchase;

            // rating snapshot for this deck
            const rr = item.deckId ? ratings[item.deckId] : null;
            const avg = rr?.avg || 0;
            const cnt = rr?.count || 0;

            // ✅ cover (from listing or fetched cache)
            const coverUrl =
              item.coverUrl || (item.deckId ? coversByDeck[String(item.deckId)] : null);

            return (
              <article key={item.id} className="card">
                {/* Cover or placeholder */}
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={`${title} cover`}
                    className="coverImg"
                    loading="lazy"
                  />
                ) : (
                  <div className="cover">Deck cover</div>
                )}

                <div className="head">
                  <div className="emoji">{emoji}</div>
                  <div className="price">{money(priceCents)}</div>
                </div>

                <h3 className="title">{title}</h3>

                <div className="meta">
                  <span className="chip">
                    {count ? `${count} cards` : "Card count —"}
                  </span>

                  {/* 🔗 Seller chip links to public profile */}
                  <span className="chip">
                    Seller:{" "}
                    {item.sellerUid ? (
                      <Link
                        href={`/u/${item.sellerUid}`}
                        className="sellerLink"
                        title="View seller profile"
                      >
                        {item.sellerName ||
                          maskEmail(item.sellerEmail) ||
                          "View profile"}
                      </Link>
                    ) : (
                      maskEmail(item.sellerEmail)
                    )}
                  </span>
                </div>

                {/* ⭐ Rating row at bottom */}
                <div className="ratingRow">
                  <Stars value={avg} />
                  <span className="muted small">{cnt ? `${avg}/5 · ${cnt}` : "No reviews yet"}</span>
                </div>

                <div className="actions">
                  {isOwned ? (
                    <span className="owned">
                      {isSeller ? "Your deck" : "Owned ✓"}
                    </span>
                  ) : (
                    item.deckId ? (
                      <Link
                        href={`/deck/${item.deckId}`}
                        className="btn primary"
                      >
                        Buy
                      </Link>
                    ) : (
                      <button className="btn" disabled title="Missing deck link">Buy</button>
                    )
                  )}
                </div>
              </article>
            );
          })}
        </section>

        <footer className="footer">
          <p className="muted">© {new Date().getFullYear()} FlashPro</p>
        </footer>
      </main>

      <style jsx global>{`
        :root{
          --bg:#f6f8fb; --surface:#ffffff; --text:#0f172a; --muted:#64748b;
          --border:#e2e8f0; --shadow:0 8px 24px rgba(2,6,23,.06);
          --primary:#2563eb; --primary-weak:#60a5fa;
        }
        *{box-sizing:border-box} html,body,#__next{height:100%}
        body{margin:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
        a{text-decoration:none;color:inherit}

        .container{max-width:1000px;margin:0 auto;padding:16px}

        /* Topbar switched to 3-column grid to fit back button on the left, title center, profile on right */
        .topbar{
          position:sticky;top:0;z-index:20;
          display:grid;grid-template-columns:1fr auto 1fr;
          align-items:center;gap:12px;
          background:var(--surface);border-bottom:1px solid var(--border);padding:12px 8px
        }
        .left-side{display:flex;align-items:center;gap:8px}
        .brand{display:flex;align-items:center;gap:10px;justify-self:center}
        .brand h1{margin:0;font-size:18px;color:var(--primary);font-weight:800}
        .logo{display:grid;place-items:center;width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,var(--primary-weak),var(--primary));color:#fff;font-weight:900;box-shadow:var(--shadow)}

        .right-side{display:flex;align-items:center;gap:12px;justify-content:flex-end}
        .profile{display:flex;align-items:center;gap:10px}
        .avatar{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:var(--primary);color:#fff;font-weight:800;box-shadow:var(--shadow)}
        .info{display:flex;flex-direction:column;align-items:flex-start;line-height:1.1}
        .email{font-size:13px;color:var(--muted)}
        .link{border:none;background:none;color:var(--primary);padding:0;font-size:12px;cursor:pointer}

        .btn{padding:10px 14px;border-radius:10px;border:1px solid var(--border);font-weight:600;background:#fff}
        .btn.primary{background:var(--primary);color:#fff;border-color:transparent;box-shadow:0 6px 18px rgba(37,99,235,.18)}
        .btn:disabled{opacity:.6}
        .back-btn{min-width:unset;padding:8px 12px;border-radius:10px}

        .filters{margin:14px 0}
        .filters input{
          width:100%;height:44px;border:1px solid var(--border);border-radius:12px;padding:0 12px;background:#fff;
        }
        .filters input:focus{outline:none;border-color:#cbd5e1;box-shadow:0 0 0 4px rgba(37,99,235,.12)}

        .grid{display:grid;gap:12px;grid-template-columns:1fr 1fr}
        @media(min-width:640px){.grid{grid-template-columns:repeat(3,1fr)}}

        .card{background:#fff;border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow);padding:14px;display:grid;gap:8px}
        .coverImg{
          width:100%;
          aspect-ratio:16/9;
          border-radius:12px;
          border:1px solid var(--border);
          object-fit:cover;
          background:#f8fafc;
        }
        .cover{
          width:100%;
          aspect-ratio:16/9;
          border-radius:12px;
          border:1px solid var(--border);
          background:#f8fafc;
          color:#94a3b8; /* slate-400 */
          display:flex;align-items:center;justify-content:center;
          font-size:12px;
        }
        .head{display:flex;justify-content:space-between;align-items:center}
        .emoji{font-size:22px}
        .price{font-weight:800}
        .title{margin:0 0 2px;font-size:16px}
        .meta{display:flex;gap:6px;flex-wrap:wrap}
        .chip{font-size:12px;color:var(--muted);background:#f8fafc;border:1px solid var(--border);border-radius:999px;padding:6px 10px}
        .sellerLink{text-decoration:underline;}
        .ratingRow{
          display:flex; align-items:center; gap:8px;
          margin-top:2px;
        }
        .stars{color:#f59e0b; letter-spacing:1px;} /* amber */
        .small{font-size:12px}

        .actions{display:flex;justify-content:flex-end}
        .empty{background:#fff;border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow);padding:16px;text-align:center;display:grid;gap:10px}

        .owned{
          display:inline-block;
          padding:10px 14px;
          border-radius:10px;
          background:#f1f5f9;
          border:1px solid var(--border);
          color:#0f172a;
          font-weight:700;
        }

        .footer{text-align:center;margin:24px 0 12px}
      `}</style>
    </>
  );
}
