// lib/firebaseAdmin.js
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Prefer explicit env, default to your known project id
const projectId = process.env.FIREBASE_PROJECT_ID || "flashcard-app-2b51e";
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "";
let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";

// Convert escaped newlines when stored like "\n" (Vercel/Windows)
if (privateKey.includes("\\n")) {
  privateKey = privateKey.replace(/\\n/g, "\n");
}

const adminApp =
  getApps()[0] ||
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
export { adminApp };
