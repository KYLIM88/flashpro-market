// lib/firebaseAdmin.js
import * as admin from "firebase-admin";
import fs from "node:fs";
import path from "node:path";

/**
 * Firebase Admin initializer — works for both:
 *  - local dev (reads ./serviceAccount.json)
 *  - Vercel deploy (reads GOOGLE_APPLICATION_CREDENTIALS_JSON env)
 */
if (!admin.apps.length) {
  let credential;

  // 1️⃣ Try Vercel env (stringified JSON)
  const jsonFromEnv =
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || // optional alias
    null;

  if (jsonFromEnv) {
    try {
      const parsed = JSON.parse(jsonFromEnv);
      credential = admin.credential.cert(parsed);
      console.log("[firebaseAdmin] Initialized from env JSON ✅");
    } catch (err) {
      console.error("[firebaseAdmin] Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:", err);
      throw err;
    }
  } else {
    // 2️⃣ Fallback to local file (for localhost)
    const filePath = path.join(process.cwd(), "serviceAccount.json");
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      credential = admin.credential.cert(parsed);
      console.log("[firebaseAdmin] Initialized from serviceAccount.json ✅");
    } catch (err) {
      console.error(
        "[firebaseAdmin] Missing or invalid serviceAccount.json and no env variable found."
      );
      throw err;
    }
  }

  admin.initializeApp({ credential });
}

const db = admin.firestore();

export { admin, db };
