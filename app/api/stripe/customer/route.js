// flashpro-market/app/api/stripe/customer/route.js
import Stripe from "stripe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  try {
    const { uid, email } = await req.json();

    if (!email || !uid) {
      return NextResponse.json(
        { error: "Missing uid or email" },
        { status: 400 }
      );
    }

    const list = await stripe.customers.list({ email, limit: 1 });
    const existing = list.data[0];

    const customer =
      existing ||
      (await stripe.customers.create({
        email,
        metadata: { uid },
      }));

    return NextResponse.json({ customerId: customer.id });
  } catch (error) {
    console.error("❌ Stripe customer creation error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
