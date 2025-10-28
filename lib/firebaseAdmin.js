// lib/firebaseAdmin.js
import * as admin from "firebase-admin";
console.log("✅ GOOGLE_APPLICATION_CREDENTIALS_JSON loaded?", !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

/**
 * Firebase Admin initializer — works for both:
 *  - local dev (.env.local → GOOGLE_APPLICATION_CREDENTIALS_JSON)
 *  - Vercel deploy (same env variable)
 */
if (!admin.apps.length) {
  let credential;

  // ✅ Always use environment variable (no file read)
  const jsonFromEnv =
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || // optional alias
    null;

  if (!jsonFromEnv) {
    throw new Error(
      "[firebaseAdmin] Missing GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable."
    );
  }

  try {
    const parsed = JSON.parse(jsonFromEnv);
    credential = admin.credential.cert(parsed);
    console.log("[firebaseAdmin] Initialized from env JSON ✅");
  } catch (err) {
    console.error(
      "[firebaseAdmin] Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:",
      err
    );
    throw err;
  }

  admin.initializeApp({ credential });
}

const db = admin.firestore();

/* ---------- Compatibility exports ---------- */
// Some files import { adminDb } from "@/lib/firebaseAdmin"
export const adminDb = db; // alias so old imports keep working

// Some files may call initAdmin(); make it a harmless no-op that returns the app
export function initAdmin() {
  return admin.apps[0] || admin.initializeApp();
}

export { admin, db };
