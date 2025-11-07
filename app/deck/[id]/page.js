// app/deck/[id]/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  limit,
  setDoc,
  serverTimestamp,
  orderBy,
  updateDoc,
} from "firebase/firestore";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";

// ✅ Use the shared Firebase instances (firebasestorage.app bucket)
import { auth, db, storage } from "@/lib/firebaseClient";

// ---- helpers ----
function money(centsVal, currency = "SGD") {
  try {
    return new Intl.NumberFormat("en-SG", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format((centsVal || 0) / 100);
  } catch {
    return `S$${((centsVal || 0) / 100).toFixed(2)}`;
  }
}
const clamp1 = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

export default function DeckDetailPage() {
  const { id: deckId } = useParams();
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [listing, setListing] = useState(null);
  const [deck, setDeck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);

  // ---- reviews state ----
  const [reviews, setReviews] = useState([]);
  const [myRating, setMyRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [myText, setMyText] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  // ---- owner edit (description + cover) ----
  const [descDraft, setDescDraft] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverPreview, setCoverPreview] = useState("");

  // auth
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // Load active listing + deck meta
  useEffect(() => {
    if (!deckId) return;
    setLoading(true);

    const qList = query(
      collection(db, "listings"),
      where("deckId", "==", String(deckId)),
      where("status", "==", "active"),
      limit(1)
    );
    const unsub = onSnapshot(
      qList,
      async (snap) => {
        const row = snap.docs[0]?.data();
        setListing(row ? { id: snap.docs[0].id, ...row } : null);

        try {
          const d = await getDoc(doc(db, "decks", String(deckId)));
          const deckData = d.exists() ? { id: d.id, ...d.data() } : null;
          setDeck(deckData);
          if (deckData) {
            setDescDraft(deckData.description || "");
            setCoverPreview(deckData.coverUrl || "");
          }
        } catch {
          setDeck(null);
        }
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [deckId]);

  // Live reviews for this deck
  useEffect(() => {
    if (!deckId) return;
    const qRev = query(
      collection(db, "decks", String(deckId), "reviews"),
      orderBy("ts", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(
      qRev,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setReviews(rows);

        if (user) {
          const mine = rows.find((r) => r.uid === user.uid);
          if (mine) {
            setMyRating(mine.rating || 0);
            setMyText(mine.text || "");
          }
        }
      },
      () => setReviews([])
    );
    return () => unsub();
  }, [deckId, user?.uid]);

  const title = useMemo(() => listing?.title || deck?.title || "Deck", [listing, deck]);

  const priceCents = useMemo(() => {
    if (typeof listing?.priceCents === "number") return listing.priceCents;
    if (typeof listing?.price_cents === "number") return listing.price_cents;
    if (typeof listing?.priceCentsSGD === "number") return listing.priceCentsSGD;
    return 0;
  }, [listing]);

  const sellerUid = listing?.sellerUid;
  const sellerEmail = listing?.sellerEmail;

  const isOwner = !!(user && deck?.uid && user.uid === deck.uid);

  const avgRating = useMemo(() => {
    if (!reviews.length) return 0;
    const sum = reviews.reduce((a, r) => a + (Number(r.rating) || 0), 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  }, [reviews]);

  async function handleBuy() {
    try {
      if (!user) return router.push("/login");
      if (!listing?.id) return alert("This deck is not available for purchase.");

      setBuying(true);
      const payload = {
        listingId: listing.id,
        buyerUid: user.uid,
        buyerEmail: user.email,
        deckId,
      };

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data;
      try {
        data = await res.clone().json();
      } catch {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (!data?.url) throw new Error("No checkout URL returned.");
      window.location.href = data.url;
    } catch (e) {
      alert(e.message || "Failed to start checkout");
      setBuying(false);
    }
  }

  async function submitReview() {
    try {
      if (!user) return router.push("/login");
      const rating = Number(myRating);
      if (!(rating >= 1 && rating <= 5))
        return alert("Please select a rating from 1 to 5 stars.");

      setSavingReview(true);
      const ref = doc(db, "decks", String(deckId), "reviews", String(user.uid));
      const displayName = user.displayName || user.email?.split("@")[0] || "User";

      await setDoc(
        ref,
        {
          uid: user.uid,
          rating,
          text: (myText || "").trim(),
          displayName,
          ts: serverTimestamp(),
        },
        { merge: true }
      );
      setSavingReview(false);
    } catch {
      alert("Failed to save review.");
      setSavingReview(false);
    }
  }

  // ---- owner: save description ----
  async function saveDescription() {
    try {
      if (!isOwner) return alert("Only the owner can edit this deck.");
      setSavingDesc(true);
      await updateDoc(doc(db, "decks", String(deckId)), {
        description: (descDraft || "").trim(),
        descriptionUpdatedAt: serverTimestamp(),
      });
      setSavingDesc(false);
    } catch (e) {
      console.error(e);
      alert("Failed to save description.");
      setSavingDesc(false);
    }
  }

  // ---- owner: upload cover image ----
  async function handleCoverFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isOwner) return alert("Only the owner can edit this deck.");

    // Ownership sanity print (kept in console, not shown on page)
    console.log("OWNERSHIP CHECK", {
      myUid: auth.currentUser?.uid,
      deckUid: deck?.uid,
      deckId,
      path: `deckCovers/${deckId}/cover...`
    });

    try {
      setUploadingCover(true);

      // MUST align with Storage Rules path
      const rawExt = (file.type?.split("/")[1] || "jpg").toLowerCase();
      const ext = rawExt === "jpeg" ? "jpg" : rawExt;
      const fileName = `cover.${ext}`;
      const path = `deckCovers/${deckId}/${fileName}`;

      const ref = sRef(storage, path);
      await uploadBytes(ref, file, { contentType: file.type || `image/${ext}` });

      const url = await getDownloadURL(ref);
      await updateDoc(doc(db, "decks", String(deckId)), {
        coverUrl: url,
        coverUpdatedAt: serverTimestamp(),
      });
      setCoverPreview(url);
    } catch (e) {
      console.error(e);
      alert(
        /unauthorized|permission|forbidden|denied/i.test(String(e?.message))
          ? "Upload blocked by Storage Rules (must be signed in as the deck owner)."
          : "Failed to upload cover."
      );
    } finally {
      setUploadingCover(false);
    }
  }

  function Star({ filled, onEnter, onLeave, onClick, size = 22 }) {
    return (
      <span
        role="button"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onClick={onClick}
        style={{
          cursor: "pointer",
          fontSize: size,
          lineHeight: 1,
          color: filled ? "var(--primary)" : "#cbd5e1",
          transition: "color .12s ease",
        }}
      >
        ★
      </span>
    );
  }

  const effectiveRating = hoverRating || myRating;

  return (
    <main className="container">
      {/* Top bar */}
      <header className="topbar">
        <div className="brand">
          <span className="logo">📚</span>
        </div>
        <div className="right-side">
          <Link href="/" className="btn">← Back to Dashboard</Link>
        </div>
      </header>

      {/* Content */}
      <section className="deckWrap">
        {loading ? (
          <div className="skeleton">Loading…</div>
        ) : !listing ? (
          <div className="empty">
            <strong>This deck is not currently for sale.</strong>
            <div className="muted">It might be unpublished or unavailable.</div>
          </div>
        ) : (
          <>
            <div className="panel">
              {/* Cover */}
              <div className="cover">
                {coverPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverPreview}
                    alt="Deck cover"
                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }}
                  />
                ) : (
                  <span>Deck cover</span>
                )}
              </div>

              {/* Owner-only controls for cover upload */}
              {isOwner && (
                <div className="ownerRow">
                  <label className="fileBtn">
                    {uploadingCover ? "Uploading…" : "Upload cover"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverFile}
                      disabled={uploadingCover}
                    />
                  </label>
                </div>
              )}

              <div className="meta">
                <h2 className="title">{title}</h2>
                <div className="price">{money(priceCents)}</div>
                <div className="seller muted">
                  Seller:&nbsp;
                  {sellerUid ? (
                    <Link href={`/u/${sellerUid}`} className="sellerLink">
                      {listing.sellerName || sellerEmail || "View profile"}
                    </Link>
                  ) : (
                    sellerEmail || "Unknown"
                  )}
                </div>

                <div className="avgRow">
                  <span className="starsReadOnly" title={`${avgRating} out of 5`}>
                    {"★★★★★".slice(0, Math.round(avgRating)) +
                      "☆☆☆☆☆".slice(0, 5 - Math.round(avgRating))}
                  </span>
                  <span className="muted small" style={{ marginLeft: 8 }}>
                    {reviews.length
                      ? `${avgRating}/5 · ${reviews.length} review${reviews.length === 1 ? "" : "s"}`
                      : "No reviews yet"}
                  </span>
                  {/* Debug line removed */}
                </div>
              </div>

              <div className="actions">
                <button
                  className="btn primary"
                  onClick={handleBuy}
                  disabled={buying}
                  aria-busy={buying}
                >
                  {buying ? "Redirecting…" : `Buy Deck — ${money(priceCents)}`}
                </button>
              </div>
            </div>

            {/* Description panel (owner can edit) */}
            <div className="panel">
              <h3 className="h3">Description</h3>
              {isOwner ? (
                <>
                  <textarea
                    placeholder="Write a short description to help buyers understand this deck…"
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    rows={4}
                  />
                  <div className="reviewActions">
                    <button
                      className="btn primary"
                      onClick={saveDescription}
                      disabled={savingDesc}
                      aria-busy={savingDesc}
                    >
                      {savingDesc ? "Saving…" : "Save description"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="descText">{deck?.description || "No description provided."}</p>
              )}
            </div>

            {/* Reviews panel */}
            <div className="panel">
              <h3 className="h3">Reviews</h3>

              {/* Write/edit my review */}
              <div className="writeReview">
                <div className="ratingPicker">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      filled={n <= (hoverRating || myRating)}
                      onEnter={() => setHoverRating(n)}
                      onLeave={() => setHoverRating(0)}
                      onClick={() => setMyRating(n)}
                      size={24}
                    />
                  ))}
                  <span className="muted small" style={{ marginLeft: 8 }}>
                    {effectiveRating ? `${effectiveRating}/5` : "Select rating"}
                  </span>
                </div>

                <textarea
                  placeholder="Share something helpful (optional)…"
                  value={myText}
                  onChange={(e) => setMyText(e.target.value)}
                  rows={3}
                />
                <div className="reviewActions">
                  {user ? (
                    <button
                      className="btn primary"
                      onClick={submitReview}
                      disabled={savingReview}
                      aria-busy={savingReview}
                    >
                      {savingReview ? "Saving…" : "Submit review"}
                    </button>
                  ) : (
                    <Link href="/login" className="btn primary">
                      Login to review
                    </Link>
                  )}
                </div>
              </div>

              {/* Reviews list */}
              <div className="reviewsList">
                {reviews.length === 0 ? (
                  <div className="muted">No reviews yet.</div>
                ) : (
                  reviews.map((r) => (
                    <div className="reviewItem" key={r.id}>
                      <div className="reviewHead">
                        <div className="reviewAvatar">
                          {(r.displayName || "U").slice(0, 1).toUpperCase()}
                        </div>
                        <div className="reviewMeta">
                          <div style={clamp1}>
                            <strong>{r.displayName || "User"}</strong>
                          </div>
                          <div className="starsReadOnly">
                            {"★★★★★".slice(0, Math.round(r.rating || 0)) +
                              "☆☆☆☆☆".slice(0, 5 - Math.round(r.rating || 0))}
                          </div>
                        </div>
                      </div>
                      {r.text ? <p className="reviewText">{r.text}</p> : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </section>

      <footer className="footer">
        <p className="muted">© {new Date().getFullYear()} FlashPro</p>
      </footer>

      {/* Theme (match dashboard) */}
      <style jsx global>{`
        :root {
          --bg: #f6f8fb;
          --surface: #ffffff;
          --text: #0f172a;
          --muted: #64748b;
          --border: #e2e8f0;
          --shadow: 0 8px 24px rgba(2, 6, 23, 0.06);
          --primary: #2563eb;
          --primary-weak: #60a5fa;
        }
        * { box-sizing: border-box; }
        html, body, #__next { height: 100%; }
        body {
          margin: 0;
          background: var(--bg);
          color: var(--text);
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        }
        a { color: inherit; text-decoration: none; }

        .container { max-width: 1000px; margin: 0 auto; padding: 16px; }
        .topbar {
          position: sticky; top: 0; z-index: 20;
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          background: var(--surface); border-bottom: 1px solid var(--border); padding: 12px 8px;
        }
        .brand { display: flex; align-items: center; gap: 10px; }
        .logo {
          display: grid; place-items: center; width: 36px; height: 36px; border-radius: 12px;
          background: linear-gradient(135deg, var(--primary-weak), var(--primary));
          color: #fff; font-weight: 900; box-shadow: var(--shadow);
        }
        .right-side { display: flex; align-items: center; gap: 12px; }
        .btn {
          padding: 10px 14px; border-radius: 10px; border: 1px solid var(--border);
          font-weight: 600; background: var(--surface);
        }
        .btn.primary {
          background: var(--primary); color: #fff; border-color: transparent;
          box-shadow: 0 6px 18px rgba(37, 99, 235, 0.18);
        }
        .btn[aria-busy="true"] { opacity: .7; }

        .deckWrap { margin-top: 18px; display: grid; gap: 12px; }
        .panel {
          background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
          box-shadow: var(--shadow); padding: 16px; display: grid; gap: 12px;
        }
        .cover {
          aspect-ratio: 16/9; border-radius: 10px; border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          color: var(--muted); background: #f8fafc; overflow: hidden;
        }
        .ownerRow { display:flex; gap:10px; align-items:center; }
        .fileBtn { position: relative; display:inline-block; padding: 8px 12px; background: var(--surface);
          border: 1px solid var(--border); border-radius: 10px; cursor: pointer; font-weight: 600; }
        .fileBtn input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }

        .meta .title { margin: 8px 0 0; font-size: 22px; }
        .price { font-weight: 800; margin-top: 6px; }
        .seller { margin-top: 4px; }
        .sellerLink { text-decoration: underline; }
        .actions { margin-top: 10px; }

        .avgRow { display: flex; align-items: center; margin-top: 8px; }
        .starsReadOnly { letter-spacing: 1px; color: #f59e0b; }

        textarea { width: 100%; border: 1px solid var(--border); background: #fff;
          border-radius: 12px; min-height: 84px; padding: 10px 12px; resize: vertical; }
        textarea:focus { outline: none; border-color: #cbd5e1; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12); }
        .descText { margin: 0; white-space: pre-wrap; }

        .writeReview { display: grid; gap: 8px; }
        .ratingPicker { display: flex; align-items: center; gap: 6px; }
        .reviewActions { display: flex; justify-content: flex-end; }

        .reviewsList { display: grid; gap: 10px; }
        .reviewItem { border: 1px solid var(--border); border-radius: 12px; padding: 12px; background: #fff; }
        .reviewHead { display: flex; gap: 10px; align-items: center; margin-bottom: 6px; }
        .reviewAvatar { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center;
          background: var(--primary); color: #fff; font-weight: 800; box-shadow: var(--shadow); }
        .reviewMeta { display: grid; gap: 2px; }
        .reviewText { margin: 0; color: var(--text); }

        .empty { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; box-shadow: var(--shadow); padding: 16px; }
        .skeleton { color: var(--muted); }
        .muted { color: var(--muted); }
        .small { font-size: 14px; }
        .footer { text-align: center; margin: 24px 0 12px; }
      `}</style>
    </main>
  );
}
