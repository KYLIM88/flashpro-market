"use client";
import { useSearchParams } from "next/navigation";

export default function SuccessClient() {
  const q = useSearchParams();
  const sessionId = q.get("session_id") || "unknown";

  return (
    <div style={{ maxWidth: 560 }}>
      <h1>✅ Payment Successful</h1>
      <p>Thanks! Your purchase is confirmed.</p>
      <p>
        Session: <code>{sessionId}</code>
      </p>
      <a href="/">Go back to home</a>
    </div>
  );
}
