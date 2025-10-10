// app/checkout/success/page.js
export const dynamic = "force-dynamic";

export default async function SuccessPage({ searchParams }) {
  const params = await searchParams; // 👈 Next 15: must await
  const sessionId = params?.get?.("session_id") ?? "unknown";

  return (
    <main className="min-h-screen grid place-items-center p-8">
      <div style={{ maxWidth: 560 }}>
        <h1>✅ Payment Successful</h1>
        <p>Thanks! Your purchase is confirmed.</p>
        <p>
          Session: <code>{sessionId}</code>
        </p>
        <a href="/">Go back to home</a>
      </div>
    </main>
  );
}
