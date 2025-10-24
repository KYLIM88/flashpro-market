// pages/purchases.js
import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
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
function formatDate(ts) {
  try {
    if (!ts) return "—";
    if (ts.toDate) return ts.toDate().toLocaleString();
    const d = new Date(ts);
    return isNaN(d.getTime()) ? "—" : d.toLocaleString();
  } catch {
    return "—";
  }
}
function pickTitle(dd, fallback = "Deck") {
  return dd?.title || dd?.name || dd?.deckName || fallback;
}

export default function PurchasesPage() {
  const [user, setUser] = useState(null);
  const [rows, setRows] = useState([]); // [{ deckId, title, coverUrl, purchasedAt }]
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // 🔒 Force light theme for this page only
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.classList.add("fp-light");
    }
    return () => {
      if (typeof document !== "undefined") {
        document.body.classList.remove("fp-light");
      }
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    let gone = false;
    async function run() {
      if (!user) {
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setErr("");

      try {
        const idxCol = collection(db, "purchasesIndex");
        let snap = await getDocs(query(idxCol, where("buyerUid", "==", user.uid)));
        const basics = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const enriched = [];
        for (const p of basics) {
          const deckId = p.deckId;
          let purchasedAt = p.ts || p.createdAt || p.purchasedAt || null;

          let title = p.title || "Deck";
          let coverUrl = p.coverUrl || "";

          if (deckId) {
            try {
              const deckDoc = await getDoc(doc(db, "decks", deckId));
              if (deckDoc.exists()) {
                const dd = deckDoc.data();
                title = pickTitle(dd, title);
                coverUrl = dd.coverUrl || coverUrl;
              }
            } catch {}
          }
          enriched.push({ deckId, title, coverUrl, purchasedAt });
        }

        enriched.sort((a, b) => {
          const ta = a.purchasedAt?.seconds
            ? a.purchasedAt.seconds * 1000
            : new Date(a.purchasedAt || 0).getTime();
          const tb = b.purchasedAt?.seconds
            ? b.purchasedAt.seconds * 1000
            : new Date(b.purchasedAt || 0).getTime();
          return tb - ta;
        });

        if (!gone) setRows(enriched);
      } catch (e) {
        console.error(e);
        if (!gone) setErr(e.message || "Failed to load purchases");
      } finally {
        if (!gone) setLoading(false);
      }
    }
    run();
    return () => {
      gone = true;
    };
  }, [user]);

  function handleLogin() {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch((e) => setErr(e.message));
  }
  function handleLogout() {
    signOut(auth).catch(() => {});
  }

  return (
    <>
      <Head>
        <title>My Purchases — FlashPro Market</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="page">
        {/* ---- Topbar (same as Sell page; + Dashboard button) ---- */}
        <div className="topbar">
          <div className="left">
            <div className="logo">📚</div>
            <div className="title">My Purchases</div>
          </div>

          <div className="right">
            <Link href="/" className="btn secondary">
              Dashboard
            </Link>
            {user ? (
              <div className="user">
                <div className="avatar">{user.email?.[0]?.toUpperCase() || "U"}</div>
                <div className="who">
                  <div className="email">{user.email}</div>
                  <button className="logout" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn primary" onClick={handleLogin}>
                Log in
              </button>
            )}
          </div>
        </div>

        {/* ---- Content ---- */}
        <div className="wrap">
          {!user && (
            <div className="panel center">
              <p>Please log in to see your purchases.</p>
              <button className="btn primary" onClick={handleLogin}>
                Log in with Google
              </button>
            </div>
          )}

          {user && loading && (
            <div className="stack">
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          )}

          {user && !loading && err && (
            <div className="panel error">
              <strong>Error:</strong> {err}
            </div>
          )}

          {user && !loading && !err && rows.length === 0 && (
            <div className="panel center">
              <p>No purchases yet.</p>
              <Link href="/market" className="btn secondary">
                Browse Market
              </Link>
            </div>
          )}

          {user && !loading && !err && rows.length > 0 && (
            <ul className="list">
              {rows.map((r) => (
                <li key={r.deckId} className="card">
                  <div className="card-left">
                    <div className="thumb">
                      {r.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.coverUrl} alt="" />
                      ) : (
                        <div className="thumb-fallback">📘</div>
                      )}
                    </div>
                    <div className="meta">
                      <div className="name">{r.title}</div>
                      <div className="sub">
                        Purchased: {formatDate(r.purchasedAt)}
                      </div>
                    </div>
                  </div>
                  {r.deckId ? (
                    <Link href={`/deck/${r.deckId}`} className="btn primary ghost">
                      Open
                    </Link>
                  ) : (
                    <span className="btn disabled">Open</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {/* ---------- Styles (100% match Sell Decks) ---------- */}
      <style jsx>{`
        :root {
          --bg: #f4f7fb;
          --panel: #ffffff;
          --text: #0b1426;
          --muted: #6b7a90;
          --border: #e4ecf5;
          --brand: #2f6bff;
          --brand-2: #4f8cff;
          --shadow: 0 12px 28px rgba(15, 24, 40, 0.12);
        }

        .page {
          max-width: 1080px;
          margin: 0 auto;
          padding: 16px;
          color: var(--text);
        }

        /* ---- Topbar ---- */
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 14px 16px;
          box-shadow: var(--shadow);
          margin-bottom: 18px;
        }
        .left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .logo {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: linear-gradient(180deg, #5aa7ff, #98c5ff);
          color: white;
          font-size: 18px;
          font-weight: 700;
        }
        .title {
          font-weight: 800;
          font-size: 20px;
        }
        .right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .user {
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
          background: #e9effa;
          color: #2751d8;
          font-weight: 800;
        }
        .who {
          display: grid;
          gap: 2px;
          text-align: right;
        }
        .email {
          font-size: 14px;
          color: #25324b;
        }
        .logout {
          appearance: none;
          background: none;
          border: 0;
          padding: 0;
          margin: 0;
          color: #4b5d7a;
          font-size: 13px;
          cursor: pointer;
        }
        .logout:hover {
          text-decoration: underline;
        }

        /* ---- Buttons ---- */
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 14px;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid var(--border);
          background: #f7faff;
          color: #234;
          box-shadow: 0 6px 14px rgba(18, 36, 70, 0.08);
          transition: transform 0.05s, box-shadow 0.2s, background 0.2s, border-color 0.2s;
        }
        .btn:hover {
          box-shadow: 0 10px 20px rgba(18, 36, 70, 0.12);
        }
        .btn:active {
          transform: translateY(1px);
        }
        .btn.primary {
          background: var(--brand);
          color: white;
          border-color: var(--brand);
        }
        .btn.primary:hover {
          background: var(--brand-2);
          border-color: var(--brand-2);
        }
        .btn.primary.ghost {
          background: white;
          color: var(--brand);
          border-color: var(--brand);
        }
        .btn.secondary {
          background: white;
          color: #1d2a44;
        }
        .btn.disabled {
          opacity: 0.55;
          pointer-events: none;
        }

        /* ---- Purchase Cards ---- */
        .list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 16px;
        }
        .card {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 18px;
          box-shadow: var(--shadow);
          transition: border-color 0.2s, box-shadow 0.2s, transform 0.05s;
        }
        .card:hover {
          border-color: #d7e4f3;
          box-shadow: 0 16px 32px rgba(15, 24, 40, 0.14);
        }
        .card:active {
          transform: translateY(1px);
        }
        .card-left {
          display: grid;
          grid-template-columns: 56px 1fr;
          gap: 14px;
          align-items: center;
        }
        .thumb {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          overflow: hidden;
          background: #eef4ff;
          border: 1px solid var(--border);
          display: grid;
          place-items: center;
        }
        .thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .thumb-fallback {
          font-size: 22px;
        }
        .meta {
          display: grid;
          gap: 4px;
        }
        .name {
          font-weight: 800;
        }
        .sub {
          font-size: 13px;
          color: var(--muted);
        }

        @media (max-width: 520px) {
          .card-left {
            grid-template-columns: 48px 1fr;
            gap: 12px;
          }
          .thumb {
            width: 48px;
            height: 48px;
          }
          .right {
            gap: 8px;
          }
          .email {
            display: none;
          }
        }
      `}</style>

      {/* 🔥 GLOBAL light override to ensure same Sell-page background */}
      <style jsx global>{`
        body.fp-light {
          background: #f4f7fb !important;
          color: #0b1426 !important;
        }
      `}</style>
    </>
  );
}
