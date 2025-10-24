// pages/seller/stripe.js
import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

// ---------- Firebase ----------
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- Helpers ----------
function maskId(id = "", visible = 6) {
  if (!id) return "";
  if (id.length <= visible) return id;
  return `${id.slice(0, visible)}…`;
}

function buildConnectUrl(origin, { uid, email }) {
  const clientId = process.env.NEXT_PUBLIC_STRIPE_CONNECT_CLIENT_ID;
  const redirectUri = `${origin}/api/sellers/oauth/callback`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "read_write",
    redirect_uri: redirectUri,
    state: uid || "",
    "stripe_user[email]": email || "",
  });
  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
}

// ---------- Page ----------
export default function StripeConnectPage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setError("");
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        setProfile(snap.exists() ? snap.data() : {});
      } catch (e) {
        console.error(e);
        setError("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    });
    return () => off();
  }, []);

  const isConnected = !!profile?.stripeAccountId;
  const stripeAccountIdMasked = useMemo(
    () => maskId(profile?.stripeAccountId || ""),
    [profile?.stripeAccountId]
  );

  const handleConnect = () => {
    if (!user) return;
    const url = buildConnectUrl(
      origin || process.env.NEXT_PUBLIC_SITE_URL || "",
      { uid: user.uid, email: user.email }
    );
    window.location.href = url;
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      console.error(e);
      setError("Sign-in failed.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {}
  };

  return (
    <>
      <Head>
        <title>Stripe Connect · FlashPro Market</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container">
        {/* ---------- Top Bar ---------- */}
        <header className="topbar">
          <div className="left">
            {/* Logo chip (no external file) */}
            <div className="logo-box">
              <span className="logo-chip" aria-hidden>📚</span>
              <h1>FlashPro Market</h1>
            </div>
            <span className="page-title">Stripe Connect</span>
          </div>

          <div className="right">
            {/* Working Dashboard button */}
            <Link href="/" className="dash-btn">Dashboard</Link>
            {user && (
              <div className="account">
                <div className="avatar">{user.email?.[0]?.toUpperCase()}</div>
                <div className="info">
                  <span className="email">{user.email}</span>
                  <button className="logout" onClick={handleLogout}>Logout</button>
                </div>
              </div>
            )}
            {!user && (
              <button className="loginLink" onClick={handleLogin}>Login</button>
            )}
          </div>
        </header>

        {/* ---------- Main Card ---------- */}
        <section className="card">
          {loading ? (
            <p className="muted">Loading…</p>
          ) : !user ? (
            <>
              <p>Please sign in to manage your Stripe connection.</p>
              <button className="primaryBtn" onClick={handleLogin}>
                Sign in with Google
              </button>
            </>
          ) : (
            <>
              <div className="rows">
                <div className="row">
                  <span className="label">Signed in as</span>
                  <span className="value">{user.email}</span>
                </div>
                <div className="row">
                  <span className="label">Status</span>
                  {isConnected ? (
                    <span className="badge ok">Connected</span>
                  ) : (
                    <span className="badge warn">Not connected</span>
                  )}
                </div>
                {isConnected && (
                  <div className="row">
                    <span className="label">Stripe Account</span>
                    <span className="value">{stripeAccountIdMasked}</span>
                  </div>
                )}
              </div>

              {!isConnected ? (
                <button
                  className="primaryBtn"
                  onClick={handleConnect}
                  disabled={!origin}
                >
                  Connect Stripe
                </button>
              ) : (
                <p className="muted small">
                  ✅ You’re all set — you can publish decks and receive payouts.
                </p>
              )}
            </>
          )}

          {error && <p className="error">{error}</p>}
        </section>

        <footer className="footer">
          <p className="muted">© {new Date().getFullYear()} FlashPro</p>
        </footer>
      </main>

      {/* ---------- Styles ---------- */}
      <style jsx global>{`
        :root{
          --bg:#edf2f7; --surface:#fff; --text:#0f172a; --muted:#64748b;
          --border:#e5eaf1; --chip:#eaf2ff; --chipText:#1d4ed8;
          --shadow:0 8px 24px rgba(15,23,42,.06); --primary:#2563eb;
          --ok:rgb(16,185,129); --okBg:rgba(16,185,129,.15);
          --warn:rgb(245,158,11); --warnBg:rgba(245,158,11,.15);
        }
        *{box-sizing:border-box}
        body{margin:0;background:var(--bg);color:var(--text);
          font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial}

        .container{max-width:900px;margin:0 auto;padding:20px 16px 28px}

        /* Top bar */
        .topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
        .left{display:flex;align-items:center;gap:16px}
        .logo-box{display:flex;align-items:center;gap:10px;background:#fff;padding:6px 10px;border-radius:12px;box-shadow:0 3px 12px rgba(0,0,0,.08)}
        .logo-chip{
          width:32px;height:32px;border-radius:10px;display:grid;place-items:center;
          background:linear-gradient(135deg,#60a5fa,#2563eb);color:#fff;font-weight:900;box-shadow:var(--shadow)
        }
        .logo-box h1{margin:0;font-size:16px;font-weight:800;color:#2563eb}
        .page-title{font-size:16px;font-weight:600;color:#334155}

        .right{display:flex;align-items:center;gap:16px}
        .dash-btn{font-weight:600;color:#2563eb;background:#eaf2ff;padding:8px 14px;border-radius:10px;text-decoration:none;box-shadow:0 2px 8px rgba(37,99,235,.1)}
        .loginLink{font-weight:600;padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:10px;cursor:pointer}

        .account{display:flex;align-items:center;gap:8px}
        .avatar{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:var(--chip);color:var(--chipText);font-weight:800}
        .info{display:flex;flex-direction:column;line-height:1.1}
        .email{font-size:13px}
        .logout{border:none;background:none;color:#475569;padding:0;font-size:12px;cursor:pointer}

        /* Card/content */
        .card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px;box-shadow:var(--shadow)}
        .rows{margin-bottom:10px}
        .row{display:flex;justify-content:space-between;align-items:center;padding:10px 2px;border-bottom:1px dashed #e8edf5}
        .row:last-child{border-bottom:none}
        .label{font-size:14px;color:#475569}
        .value{font-size:15px;font-weight:600}

        .badge{font-size:12px;padding:4px 8px;border-radius:999px;font-weight:700}
        .badge.ok{background:var(--okBg);color:var(--ok)}
        .badge.warn{background:var(--warnBg);color:var(--warn)}

        .primaryBtn{width:100%;margin-top:8px;padding:12px 16px;border-radius:12px;border:1px solid transparent;font-size:16px;font-weight:700;cursor:pointer;background:var(--primary);color:#fff;box-shadow:0 6px 18px rgba(37,99,235,.18)}

        .muted{color:var(--muted)}
        .small{font-size:12px}
        .error{color:#dc2626;margin-top:10px}
        .footer{text-align:center;margin:28px 0 8px}
      `}</style>
    </>
  );
}
