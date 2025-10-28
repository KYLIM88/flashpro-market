// lib/firebaseAdmin.js
import * as admin from "firebase-admin";
console.log("✅ GOOGLE_APPLICATION_CREDENTIALS_JSON loaded?", !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

function buildCredentialFromEnv() {
  // Preferred: full JSON blob in a single env var
  const jsonBlob =
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    null;

  if (jsonBlob) {
    let parsed = JSON.parse(jsonBlob);
    // 🔧 Normalize private_key newlines if pasted as \n
    if (parsed.private_key && typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return admin.credential.cert(parsed);
  }

  // Fallback: separate vars (email + private key)
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (clientEmail && privateKey) {
    // 🔧 Normalize private_key newlines
    privateKey = privateKey.replace(/\\n/g, "\n");
    return admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID, // optional but nice to have
      clientEmail,
      privateKey,
    });
  }

  throw new Error(
    "[firebaseAdmin] Missing credentials. Set GOOGLE_APPLICATION_CREDENTIALS_JSON (preferred) or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY."
  );
}

/**
 * Firebase Admin initializer (works on Vercel + local)
 */
if (!admin.apps.length) {
  const credential = buildCredentialFromEnv();
  admin.initializeApp({ credential });
  console.log("[firebaseAdmin] Initialized Admin SDK ✅");
}

const db = admin.firestore();

/* ---------- Compatibility exports ---------- */
export const adminDb = db; // alias for legacy imports

export function initAdmin() {
  return admin.apps[0] || admin.initializeApp({ credential: buildCredentialFromEnv() });
}

export { admin, db };
