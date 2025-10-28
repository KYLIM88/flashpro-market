"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";

// ---------- Firebase (client) ----------
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

export default function LoginPage() {
  // mount gate to avoid SSR/client HTML mismatch
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        // already signed in → go dashboard
        window.location.href = "/";
      }
    });
    return () => unsub();
  }, []);

  async function loginGoogle() {
    try {
      setErr("");
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      window.location.href = "/";
    } catch (e) {
      setErr(e?.message || "Google sign-in failed.");
      console.error(e);
    }
  }

  async function loginEmail(evn) {
    evn.preventDefault();
    try {
      setErr("");
      await signInWithEmailAndPassword(auth, email.trim(), password);
      window.location.href = "/";
    } catch (e) {
      setErr(e?.message || "Email sign-in failed.");
      console.error(e);
    }
  }

  if (!mounted) return null; // avoid hydration entirely

  return (
    <main
      suppressHydrationWarning
      style={{
        maxWidth: 420,
        margin: "40px auto",
        padding: "20px",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
      }}
    >
      <h2 style={{ margin: "0 0 12px", fontSize: 24, fontWeight: 800, color: "#2563eb" }}>
        Sign in
      </h2>

      <button
        onClick={loginGoogle}
        style={{
          width: "100%",
          background: "#2563eb",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          padding: "10px 14px",
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 6px 18px rgba(37,99,235,0.18)",
          marginBottom: 16,
        }}
      >
        Sign in with Google
      </button>

      <form
        onSubmit={loginEmail}
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 8px 24px rgba(2,6,23,0.06)",
        }}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <input
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 14,
            }}
          />
          <input
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 14,
            }}
          />
          <button
            type="submit"
            style={{
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "10px 14px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 6px 18px rgba(37,99,235,0.18)",
            }}
          >
            Sign in
          </button>
        </div>
        {err ? (
          <p style={{ color: "#dc2626", marginTop: 10, fontSize: 13 }}>{err}</p>
        ) : null}
      </form>

      <div style={{ marginTop: 16 }}>
        <Link href="/" style={{ color: "#2563eb", fontWeight: 600 }}>
          ← Back to Dashboard
        </Link>
      </div>
    </main>
  );
}
