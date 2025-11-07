// pages/u/[uid].js
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../lib/firebaseClient";

// ---- tiny helpers ----
const currency = (n) =>
  typeof n === "number" && !Number.isNaN(n) ? `S$${n.toFixed(2)}` : "—";

const priceFrom = (row) =>
  typeof row?.price === "number"
    ? row.price
    : typeof row?.priceCents === "number"
    ? row.priceCents / 100
    : undefined;

export default function PublicProfilePage() {
  const router = useRouter();
  const { uid } = router.query;

  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  // cover cache: { [deckId]: coverUrl|null }
  const [coversByDeck, setCoversByDeck] = useState({});

  // Load public profile
  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", String(uid)));
        setProfile(snap.exists() ? snap.data() : null);
      } catch (e) {
        console.error("Load profile", e);
        setProfile(null);
      }
    })();
  }, [uid]);

  // Live listings for this seller (status == active)
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "listings"),
      where("sellerUid", "==", String(uid)),
      where("status", "==", "active")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setListings(rows);
        setLoading(false);
      },
      (err) => {
        console.error("Load listings", err);
        setListings([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid]);

  // Fetch deck coverUrl for any listing we don't have yet
  useEffect(() => {
    if (!listings?.length) return;
    let cancelled = false;

    (async () => {
      const needed = listings
        .map((l) => String(l.deckId))
        .filter((id) => !(id in coversByDeck));

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
  }, [listings, coversByDeck]);

  const displayName =
    profile?.displayName ||
    profile?.name ||
    profile?.username ||
    "Marketplace Seller";
  const photoURL =
    profile?.photoURL ||
    "https://avatars.githubusercontent.com/u/9919?s=200&v=4"; // neutral placeholder
  const bio = profile?.bio || profile?.about || "";

  return (
    <>
      <Head>
        <title>{displayName} — FlashPro Market</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container">
        {/* Top bar */}
        <header className="topbar">
          <div className="brand">
            <span className="logo">📚</span>
            <h1>Seller Profile</h1>
          </div>

          <div className="right-side">
            <Link href="/" className="btn">
              ← Back to Dashboard
            </Link>
          </div>
        </header>

        {/* Profile header */}
        <section className="profileHeader">
          <img
            src={photoURL}
            alt={displayName}
            width={96}
            height={96}
            className="avatar"
          />
          <div className="profileText">
            <h2 className="title">{displayName}</h2>
            <p className="muted">
              {bio ? bio : "No bio yet. Check out their decks below."}
            </p>
            <p className="muted small">
              {loading
                ? "Loading listings…"
                : `${listings.length} active listing${
                    listings.length === 1 ? "" : "s"
                  }`}
            </p>
          </div>
        </section>

        {/* Listings grid */}
        <section>
          {loading ? null : listings.length === 0 ? (
            <div className="empty">
              <strong>No active listings yet.</strong>
              <div className="muted">
                When this seller publishes decks, they’ll appear here.
              </div>
            </div>
          ) : (
            <div className="grid">
              {listings.map((row) => {
                const price = priceFrom(row);
                const coverUrl =
                  row.coverUrl || coversByDeck[String(row.deckId)] || null;

                return (
                  <Link
                    key={row.id}
                    href={`/deck/${row.deckId}`}
                    className="card"
                  >
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt={`${row.title || "Deck"} cover`}
                        className="coverImg"
                        loading="lazy"
                      />
                    ) : (
                      <div className="cover">Deck cover</div>
                    )}

                    <div className="cardTitle" title={row.title || "Untitled"}>
                      {row.title || "Untitled deck"}
                    </div>
                    <div className="cardPrice">{currency(price)}</div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <footer className="footer">
          <p className="muted">© {new Date().getFullYear()} FlashPro</p>
        </footer>
      </main>

      {/* Match Dashboard (light theme) */}
      <style jsx global>{`
        :root {
          --bg: #f6f8fb;
          --surface: #ffffff;
          --text: #0f172a; /* slate-900 */
          --muted: #64748b; /* slate-500 */
          --border: #e2e8f0; /* slate-200 */
          --shadow: 0 8px 24px rgba(2, 6, 23, 0.06);
          --primary: #2563eb; /* blue-600 */
          --primary-weak: #60a5fa; /* blue-400 */
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
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          padding: 12px 8px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
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
        }
        .btn {
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid var(--border);
          font-weight: 600;
          background: var(--surface);
        }

        .profileHeader {
          display: flex;
          gap: 16px;
          align-items: center;
          margin: 18px 2px 24px;
        }
        .avatar {
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid rgba(0, 0, 0, 0.06);
          box-shadow: var(--shadow);
          background: #fff;
        }
        .profileText {
          flex: 1;
          min-width: 0;
        }
        .title {
          margin: 0;
          font-size: 28px;
          line-height: 1.2;
        }
        .muted {
          color: var(--muted);
        }
        .small {
          font-size: 14px;
          margin-top: 6px;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (min-width: 640px) {
          .grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .card {
          display: block;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 14px;
          box-shadow: var(--shadow);
          transition: transform 0.12s ease, box-shadow 0.12s ease,
            border-color 0.12s ease;
        }
        .card:hover {
          transform: translateY(-2px);
          border-color: #cbd5e1;
          box-shadow: 0 10px 26px rgba(2, 6, 23, 0.12);
        }

        .cover {
          aspect-ratio: 16/9;
          border-radius: 10px;
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          color: var(--muted);
          background: #f8fafc;
          margin-bottom: 10px;
        }
        .coverImg {
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 10px;
          border: 1px solid var(--border);
          object-fit: cover;
          background: #f8fafc;
          display: block;
          margin-bottom: 10px;
        }

        .cardTitle {
          font-weight: 700;
          margin-bottom: 6px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cardPrice {
          font-size: 14px;
          opacity: 0.85;
        }

        .empty {
          padding: 24px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
          box-shadow: var(--shadow);
        }

        .footer {
          text-align: center;
          margin: 24px 0 12px;
        }
      `}</style>
    </>
  );
}
