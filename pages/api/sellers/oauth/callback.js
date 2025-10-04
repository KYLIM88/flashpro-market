// pages/api/sellers/oauth/callback.js
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

export default async function handler(req, res) {
  try {
    // Stripe can send ?error=...
    if (req.query.error) {
      return res
        .status(400)
        .send(`<pre>Stripe error: ${req.query.error_description || req.query.error}</pre>
               <p><a href="/sell">← Back to Sell</a></p>`);
    }

    const { code } = req.query;
    if (!code) {
      return res.status(400).send(`<pre>Missing ?code in callback</pre><p><a href="/sell">← Back to Sell</a></p>`);
    }

    // Exchange short-lived code for a token (single-use!)
    const token = await stripe.oauth.token({ grant_type: "authorization_code", code });
    const connectedAccountId = token.stripe_user_id; // e.g. "acct_123..."

    // Auto-save to localStorage and redirect to /sell
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(`
      <script>
        try {
          localStorage.setItem('stripe_account_id', '${connectedAccountId}');
          window.location = '/sell?connected=1';
        } catch (e) {
          document.write('<h1>Connected</h1><p>Account: ${connectedAccountId}</p><p><a href="/sell">Back to Sell</a></p>');
        }
      </script>
    `);
  } catch (err) {
    // Most common: "authorization code has already been used"
    const msg = (err && err.message) || "OAuth failed";
    return res
      .status(400)
      .send(`<pre>OAuth failed: ${msg}</pre><p>Solution: go back to <a href="/sell">/sell</a> and click the Connect button again to get a fresh code.</p>`);
  }
}
