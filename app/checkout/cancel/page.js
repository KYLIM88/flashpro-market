// app/checkout/cancel/page.js
export const dynamic = "force-dynamic";

export default function CancelPage() {
  return (
    <main className="min-h-screen grid place-items-center p-8">
      <div style={{ maxWidth: 560 }}>
        <h1>❌ Payment Cancelled</h1>
        <p>No charge was made.</p>
        <a href="/">Try again</a>
      </div>
    </main>
  );
}
