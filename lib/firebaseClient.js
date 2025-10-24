// flashpro-market/lib/firebaseClient.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDINBKwVCO6P7EXLyJpaJ_rOUK85RJ4y0g",
  authDomain: "flashcard-app-2b51e.firebaseapp.com",
  projectId: "flashcard-app-2b51e",
  storageBucket: "flashcard-app-2b51e.firebasestorage.app",
  messagingSenderId: "1873502676",
  appId: "1:1873502676:web:34e8817d867e050a37f641",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ✅ export READY instances
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
