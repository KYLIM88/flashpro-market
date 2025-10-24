// app/api/purchase/save/route.js
import { NextResponse } from "next/server";

// temporary in-memory array (for testing)
let purchases = [];

export async function POST(req) {
  const data = await req.json();
  purchases.push(data);
  console.log("✅ Purchase saved:", data);
  return NextResponse.json({ success: true });
}

export async function GET() {
  return NextResponse.json(purchases);
}
