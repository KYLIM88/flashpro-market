import Head from "next/head";
import Link from "next/link";

export default function HelpPage() {
  return (
    <>
      <Head>
        <title>Help • FlashPro Marketplace</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Force full white background */}
      <style jsx global>{`
        html, body, #__next {
          background: #ffffff !important;
          color: #171717;
          min-height: 100%;
        }
      `}</style>

      <main className="wrap">
        <div className="topbar">
          <Link href="/" className="backBtn">← Back to Dashboard</Link>
        </div>

        <h1 className="title">Help & Support</h1>

        <section className="card">
          <h2 className="cardTitle">Need a hand?</h2>
          <p className="muted">
            This marketplace uses Stripe for payments and Firebase for login.
            If you’re stuck or something doesn’t look right, reach out — we’re here to help.
          </p>

          {/* Plain text email */}
          <p className="emailLine">Email: flashproapp@gmail.com</p>

          <hr className="divider" />

          <ul className="bullets">
            <li>Payment issues (failed or pending Checkout)</li>
            <li>Deck access after purchase</li>
            <li>Publishing / pricing your deck</li>
            <li>Stripe Connect or payouts</li>
          </ul>
        </section>

        <section className="note">
          Tip: include your account email, deck link, and a short description of the problem.
        </section>
      </main>

      <style jsx>{`
        .wrap {
          max-width: 860px;
          margin: 0 auto;
          padding: 16px;
        }
        .topbar {
          display: flex;
          justify-content: flex-start;
          margin-bottom: 12px;
        }
        .backBtn {
          display: inline-block;
          padding: 10px 14px;
          border-radius: 10px;
          background: #eef2ff;
          color: #1f2937;
          font-weight: 600;
          text-decoration: none;
        }
        .title {
          font-size: 26px;
          line-height: 1.2;
          margin: 10px 0 16px;
          color: #111827;
        }
        .card {
          background: #ffffff;
          color: #111827;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 18px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .cardTitle {
          font-size: 20px;
          margin: 0 0 8px;
          font-weight: 700;
        }
        .muted {
          color: #4b5563;
          margin: 0 0 14px;
        }
        .emailLine {
          margin: 0 0 8px;
          font-weight: 600;
          color: #111827;
        }
        .divider {
          border: 0;
          height: 1px;
          background: #e5e7eb;
          margin: 16px 0;
        }
        .bullets {
          padding-left: 18px;
          margin: 0;
        }
        .bullets li {
          margin: 8px 0;
        }
        .note {
          margin-top: 14px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          color: #334155;
          padding: 12px 14px;
          border-radius: 12px;
          font-size: 14px;
        }
        @media (min-width: 640px) {
          .title { font-size: 28px; }
          .card { padding: 20px; }
        }
      `}</style>
    </>
  );
}
