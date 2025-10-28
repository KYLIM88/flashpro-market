// app/api/debug/write/route.js
import { db } from "@/lib/firebaseAdmin";           // ✅ use db (not adminDb)
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const buyerEmail = searchParams.get("email") || "test@example.com";
    const deckId = searchParams.get("deckId") || "TEST_DECK_ID";

    await db.collection("purchases").add({
      buyerEmail,
      deckId,
      createdAt: FieldValue.serverTimestamp(),
      source: "debug-write",
    });

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("debug/write error:", e);
    return new Response("fail", { status: 500 });
  }
}
