"use client";

import React, { useState } from "react";
import { UnreviewedItem } from "@/lib/account-summary";

interface ReviewPromptsProps {
  items: UnreviewedItem[];
  onReviewSubmitted?: (orderId: string, productId: string) => void;
}

interface ReviewCardState {
  rating: number;
  hoverRating: number;
  text: string;
  loading: boolean;
  error: string | null;
  submitted: boolean;
}

export function ReviewPrompts({ items, onReviewSubmitted }: ReviewPromptsProps) {
  const [activeItems, setActiveItems] = useState<UnreviewedItem[]>(items);
  const [formStates, setFormStates] = useState<Record<string, ReviewCardState>>({});

  // Sync state if items prop updates
  React.useEffect(() => {
    setActiveItems(items);
  }, [items]);

  const getItemKey = (item: UnreviewedItem) => `${item.orderId}_${item.productId}`;

  const getFormState = (key: string): ReviewCardState => {
    return (
      formStates[key] || {
        rating: 5,
        hoverRating: 0,
        text: "",
        loading: false,
        error: null,
        submitted: false,
      }
    );
  };

  const updateFormState = (key: string, patch: Partial<ReviewCardState>) => {
    setFormStates((prev) => ({
      ...prev,
      [key]: {
        ...getFormState(key),
        ...patch,
      },
    }));
  };

  const handleSubmit = async (item: UnreviewedItem) => {
    const key = getItemKey(item);
    const state = getFormState(key);

    if (state.rating < 1 || state.rating > 5) {
      updateFormState(key, { error: "Please select a star rating between 1 and 5." });
      return;
    }

    updateFormState(key, { loading: true, error: null });

    try {
      let token: string | null = null;
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem("nanos_auth_v1");
        if (raw) {
          const parsed = JSON.parse(raw);
          token = parsed.token || null;
        }
      }

      if (!token) {
        throw new Error("You must be logged in to submit a review.");
      }

      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: item.orderId,
          productId: item.productId,
          rating: state.rating,
          text: state.text.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit review.");
      }

      updateFormState(key, { loading: false, submitted: true });

      // After small delay, notify parent and dismiss
      setTimeout(() => {
        setActiveItems((prev) => prev.filter((i) => getItemKey(i) !== key));
        if (onReviewSubmitted) {
          onReviewSubmitted(item.orderId, item.productId);
        }
      }, 1500);
    } catch (err: any) {
      updateFormState(key, { loading: false, error: err.message || "An error occurred." });
    }
  };

  return (
    <div style={{ marginBottom: 32 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-head)",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            margin: 0,
          }}
        >
          Rate Delivered Products {activeItems.length > 0 && `(${activeItems.length})`}
        </h3>
      </div>

      {activeItems.length === 0 ? (
        <div
          style={{
            background: "var(--white)",
            border: "1px solid var(--stone)",
            borderRadius: 8,
            padding: "20px 22px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            color: "#666",
            fontSize: 13.5,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "rgba(202, 255, 0, 0.2)",
              color: "var(--black)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontWeight: 700,
            }}
          >
            ✓
          </div>
          <div>
            <div style={{ fontWeight: 600, color: "var(--black)" }}>
              You&apos;re all caught up on reviews!
            </div>
            <div style={{ fontSize: 12.5, color: "#666" }}>
              Thank you for sharing your feedback on delivered orders.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {activeItems.map((item) => {
            const key = getItemKey(item);
            const state = getFormState(key);
            const displayRating = state.hoverRating || state.rating;

            return (
              <div
                key={key}
                style={{
                  background: "var(--white)",
                  border: "1px solid var(--stone)",
                  borderRadius: 8,
                  padding: "18px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  transition: "all 0.2s ease",
                }}
              >
                {/* Header with product details & verified buyer tag */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {item.productHero ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.productHero}
                        alt={item.productName}
                        style={{
                          width: 44,
                          height: 44,
                          objectFit: "cover",
                          borderRadius: 6,
                          background: "var(--stone)",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 6,
                          background: "var(--stone)",
                        }}
                      />
                    )}
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--black)" }}>
                        {item.productName}
                      </div>
                      <div style={{ fontSize: 12, color: "#666" }}>
                        {item.color} · {item.size}
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "3px 8px",
                      borderRadius: 4,
                      background: "rgba(202, 255, 0, 0.2)",
                      color: "var(--black)",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    <span>✓</span>
                    <span>Verified Buyer</span>
                  </span>
                </div>

                {state.submitted ? (
                  <div
                    style={{
                      background: "rgba(202, 255, 0, 0.15)",
                      color: "var(--black)",
                      padding: "12px 14px",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span>✓</span>
                    <span>Review submitted! Thank you for your feedback.</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* Star Rating Selector */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#444" }}>Rating:</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        {[1, 2, 3, 4, 5].map((star) => {
                          const filled = star <= displayRating;
                          return (
                            <button
                              key={star}
                              type="button"
                              onClick={() => updateFormState(key, { rating: star })}
                              onMouseEnter={() => updateFormState(key, { hoverRating: star })}
                              onMouseLeave={() => updateFormState(key, { hoverRating: 0 })}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 2,
                                color: filled ? "#f59e0b" : "#d1d5db",
                                fontSize: 20,
                                lineHeight: 1,
                                transition: "transform 0.1s ease",
                              }}
                              aria-label={`Rate ${star} star`}
                            >
                              ★
                            </button>
                          );
                        })}
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--black)", marginLeft: 4 }}>
                        {state.rating} / 5
                      </span>
                    </div>

                    {/* Optional text input */}
                    <textarea
                      placeholder="Write a brief review (comfort, sizing, material) — optional"
                      value={state.text}
                      onChange={(e) => updateFormState(key, { text: e.target.value })}
                      rows={2}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        fontSize: 13,
                        borderRadius: 6,
                        border: "1px solid var(--stone)",
                        background: "var(--cream, #fdfbf7)",
                        resize: "vertical",
                        fontFamily: "inherit",
                      }}
                    />

                    {state.error && (
                      <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
                        {state.error}
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => handleSubmit(item)}
                        disabled={state.loading}
                        className="btn btn-secondary btn-sm"
                        style={{
                          height: 38,
                          minHeight: 38,
                          padding: "8px 18px",
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {state.loading ? "Submitting…" : "Submit Review"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
