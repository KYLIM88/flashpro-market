// flashpro-market/lib/firebaseClient.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDINBKwVCO6P7EXLyJpaJ_rOUK85RJ4y0g",
  authDomain: "flashcard-app-2b51e.firebaseapp.com",
  projectId: "flashcard-app-2b51e",
  // ✅ updated to match your actual bucket name in Cloud Shell
  storageBucket: "flashcard-app-2b51e.firebasestorage.app",
  messagingSenderId: "1873502676",
  appId: "1:1873502676:web:34e8817d867e050a37f641",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ✅ ready instances
export const auth = getAuth(app);
export const db = getFirestore(app);

// ✅ force exact bucket (same as CORS + env)
const BUCKET = "flashcard-app-2b51e.firebasestorage.app";
export const storage = getStorage(app, `gs://${BUCKET}`);

export const googleProvider = new GoogleAuthProvider();

// (optional) debug in browser console
if (typeof window !== "undefined") {
  console.log("[Firebase] storage bucket in use:", BUCKET);
}
