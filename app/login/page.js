"use client";
import { auth, googleProvider } from "@/lib/firebaseClient";
import { signInWithPopup, signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState(""); 
  const [password, setPassword] = useState("");
  const router = useRouter();

  async function loginEmail() {
    await signInWithEmailAndPassword(auth, email, password);
    router.push("/");
  }
  async function loginGoogle() {
    await signInWithPopup(auth, googleProvider);
    router.push("/");
  }

  return (
    <main style={{maxWidth:420,margin:"40px auto",padding:16}}>
      <h2>Sign in to FlashPro</h2>
      <button onClick={loginGoogle}>Sign in with Google</button>
      <div style={{margin:"16px 0"}} />
      <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button onClick={loginEmail}>Sign in</button>
    </main>
  );
}
