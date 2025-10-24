import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";

// Reads from .env.local
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

export default function Dashboard() {
  const [user, setUser] = useState(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <>
      <Head>
        <title>FlashPro — Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container">
        {/* Top bar */}
        <header className="topbar">
          <div className="brand">
            <span className="logo">📚</span>
            <h1>FlashPro Market</h1>
          </div>

          <div className="right-side">
            {user ? (
              <div className="profile">
                <div className="avatar">{user.email[0].toUpperCase()}</div>
                <div className="info">
                  <span className="email">{user.email}</span>
                  <button className="link" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <Link href="/login" className="btn primary">
                Login
              </Link>
            )}
          </div>
        </header>

        {/* Welcome */}
        <section className="welcome">
          <h2>Dashboard</h2>
          <p className="muted">Quick snapshot of your marketplace.</p>
        </section>

        {/* Grid */}
        <section className="grid">
          <Link href="/market" className="card">
            <div className="card-emoji">🛒</div>
            <h3>Browse Market</h3>
            <p>Find decks to buy.</p>
          </Link>

          <Link href="/purchases" className="card">
            <div className="card-emoji">💳</div>
            <h3>My Purchases</h3>
            <p>See decks you own.</p>
          </Link>

          <Link href="/seller/decks" className="card">
            <div className="card-emoji">📚</div>
            <h3>Sell Decks</h3>
            <p>Create and manage what you’re selling.</p>
          </Link>

          {/* ✅ Fixed Stripe Connect path */}
          <Link href="/seller/stripe" className="card">
            <div className="card-emoji">🏦</div>
            <h3>Stripe Connect</h3>
            <p>Onboard for payouts.</p>
          </Link>

          <Link href="/analytics" className="card">
            <div className="card-emoji">📈</div>
            <h3>Analytics</h3>
            <p>Sales and trends.</p>
          </Link>

          <Link href="/help" className="card">
            <div className="card-emoji">❓</div>
            <h3>Help</h3>
            <p>Docs & support.</p>
          </Link>
        </section>

        <footer className="footer">
          <p className="muted">© {new Date().getFullYear()} FlashPro</p>
        </footer>
      </main>

      {/* FlashPro light theme */}
      <style jsx global>{`
        :root {
          /* FlashPro palette (light) */
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
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto,
            Helvetica, Arial;
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
        .btn.primary {
          background: var(--primary);
          color: #fff;
          border-color: transparent;
          box-shadow: 0 6px 18px rgba(37, 99, 235, 0.18);
        }
        .btn.primary:hover {
          filter: brightness(0.98);
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

        .welcome {
          margin: 18px 2px;
        }
        .welcome h2 {
          margin: 0 0 4px;
          font-size: 26px;
        }
        .muted {
          color: var(--muted);
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
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 16px;
          min-height: 120px;
          display: grid;
          align-content: start;
          gap: 6px;
          box-shadow: var(--shadow);
          transition: transform 0.12s ease, box-shadow 0.12s ease,
            border-color 0.12s ease;
        }
        .card:hover {
          transform: translateY(-2px);
          border-color: #cbd5e1;
          box-shadow: 0 10px 26px rgba(2, 6, 23, 0.12);
        }
        .card-emoji {
          font-size: 22px;
        }
        .card h3 {
          margin: 2px 0 0;
          font-size: 16px;
        }
        .card p {
          margin: 0;
          color: var(--muted);
          font-size: 13px;
        }

        .footer {
          text-align: center;
          margin: 24px 0 12px;
        }
      `}</style>
    </>
  );
}
