"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useWishlist, WishlistItem } from "@/context/WishlistContext";
import { fmtPrice } from "@/lib/cart";

export function CartDrawer() {
  const router = useRouter();
  const cart = useCart();
  const wishlist = useWishlist();
  const [quickAddedId, setQuickAddedId] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; message: string } | null>(null);

  // Lock body scroll when cart drawer is open
  useEffect(() => {
    if (cart.isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [cart.isOpen]);

  // ESC key handler to close cart drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && cart.isOpen) {
        cart.closeCart();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart.isOpen, cart]);

  function handleQuickAddLiked(item: WishlistItem) {
    cart.addItem(
      {
        productId: item.productId,
        name: item.name,
        color: item.color || "Standard",
        size: item.size || "Standard",
        price: item.price,
        img: item.img,
      },
      1
    );
    setQuickAddedId(item.productId);
    setTimeout(() => setQuickAddedId(null), 1400);
  }

  async function handleApplyPromo(e: React.FormEvent) {
    e.preventDefault();
    if (!promoInput.trim()) return;
    const res = await cart.applyPromo(promoInput);
    setPromoMsg(res);
    if (res.ok) setPromoInput("");
  }

  function handleCheckout() {
    cart.closeCart();
    router.push("/checkout");
  }

  return (
    <>
      {cart.isOpen && <div className="cart-overlay" onClick={cart.closeCart} />}
      <div className={`cart-drawer ${cart.isOpen ? "open" : ""}`}>
        {/* Header */}
        <div className="cart-drawer-header">
          <div style={{ fontFamily: "var(--font-head)", fontSize: 16, fontWeight: 700 }}>
            Cart ({cart.count} {cart.count === 1 ? "item" : "items"})
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={cart.closeCart}
            aria-label="Close cart"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="cart-drawer-body">
          {cart.items.length === 0 ? (
            <div className="cart-empty" style={{ padding: "28px 16px 20px" }}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                style={{ width: 44, height: 44, margin: "0 auto 12px", color: "var(--stone)" }}
              >
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              <h3 style={{ fontFamily: "var(--font-head)", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
                Your cart is empty
              </h3>
              <p style={{ fontSize: 12.5, color: "#666", marginBottom: 16 }}>
                Explore our collection to find your pair.
              </p>
              <button
                type="button"
                className="cart-checkout-btn"
                style={{ maxWidth: 180, margin: "0 auto 20px", minHeight: 40, padding: "10px 18px", fontSize: 13 }}
                onClick={() => {
                  cart.closeCart();
                  router.push("/products");
                }}
              >
                Shop Now
              </button>

              {/* Liked / Wishlist Quick Options */}
              {wishlist.items.length > 0 && (
                <div style={{ marginTop: 20, textAlign: "left", width: "100%", borderTop: "1px solid var(--stone, #e5e5e5)", paddingTop: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-head)", letterSpacing: "-0.01em" }}>
                      ❤️ Liked Items ({wishlist.items.length})
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {wishlist.items.map((liked) => (
                      <div
                        key={liked.productId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "10px 12px",
                          background: "var(--white, #fff)",
                          border: "1px solid var(--stone, #e5e5e5)",
                          borderRadius: 6,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={liked.img}
                            alt={liked.name}
                            style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 4, background: "#f0f0f0", flexShrink: 0 }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {liked.name}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--black, #111)", marginTop: 2 }}>
                              {fmtPrice(liked.price)}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickAddLiked(liked)}
                          style={{
                            background: quickAddedId === liked.productId ? "var(--black, #111)" : "var(--lime, #C8FF00)",
                            color: quickAddedId === liked.productId ? "var(--lime, #C8FF00)" : "var(--black, #111)",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: 4,
                            fontSize: 11.5,
                            fontWeight: 700,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                            transition: "all 0.15s ease",
                          }}
                        >
                          {quickAddedId === liked.productId ? "Added ✓" : "+ Add"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {cart.items.map((item) => (
                <div key={`${item.productId}-${item.color}-${item.size}`} className="cart-item">
                  {item.img ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.img} alt={item.name} className="cart-item-img" />
                  ) : (
                    <div className="cart-item-img" style={{ background: "var(--stone)" }} />
                  )}
                  <div className="cart-item-info">
                    <div className="cart-item-name">{item.name}</div>
                    <div className="cart-item-meta">
                      {item.color} · {item.size}
                    </div>
                    <div className="cart-item-price">{fmtPrice(item.price)}</div>
                    <div className="cart-qty">
                      <button
                        type="button"
                        onClick={() =>
                          cart.updateQty(item.productId, item.color, item.size, -1)
                        }
                      >
                        −
                      </button>
                      <span>{item.qty}</span>
                      <button
                        type="button"
                        onClick={() =>
                          cart.updateQty(item.productId, item.color, item.size, 1)
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="cart-remove"
                    onClick={() => cart.removeItem(item.productId, item.color, item.size)}
                    aria-label="Remove item"
                  >
                    ×
                  </button>
                </div>
              ))}

              {/* From Wishlist quick-add options inside active cart */}
              {wishlist.items.filter((w) => !cart.items.some((ci) => ci.productId === w.productId)).length > 0 && (
                <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px dashed var(--stone, #e5e5e5)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 10, letterSpacing: "-0.01em" }}>
                    From Your Wishlist
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {wishlist.items
                      .filter((w) => !cart.items.some((ci) => ci.productId === w.productId))
                      .slice(0, 3)
                      .map((liked) => (
                        <div
                          key={liked.productId}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            padding: "8px 10px",
                            background: "rgba(200, 255, 0, 0.06)",
                            border: "1px solid rgba(200, 255, 0, 0.3)",
                            borderRadius: 6,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={liked.img}
                              alt={liked.name}
                              style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4, background: "#f0f0f0", flexShrink: 0 }}
                            />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {liked.name}
                              </div>
                              <div style={{ fontSize: 11.5, color: "#666" }}>
                                {fmtPrice(liked.price)}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleQuickAddLiked(liked)}
                            style={{
                              background: quickAddedId === liked.productId ? "var(--black, #111)" : "var(--lime, #C8FF00)",
                              color: quickAddedId === liked.productId ? "var(--lime, #C8FF00)" : "var(--black, #111)",
                              border: "none",
                              padding: "5px 10px",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                              transition: "all 0.15s ease",
                            }}
                          >
                            {quickAddedId === liked.productId ? "Added ✓" : "+ Add"}
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {cart.items.length > 0 && (
          <div className="cart-drawer-footer">
            <form onSubmit={handleApplyPromo} className="promo-row">
              <input
                type="text"
                className="promo-input"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
              />
              <button type="submit" className="promo-apply">
                Apply
              </button>
            </form>

            {(promoMsg || cart.promo) && (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 12,
                  padding: "7px 10px",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  color: promoMsg ? (promoMsg.ok ? "#166534" : "#991b1b") : "#166534",
                  background: promoMsg
                    ? promoMsg.ok
                      ? "rgba(34, 197, 94, 0.12)"
                      : "rgba(239, 68, 68, 0.1)"
                    : "rgba(34, 197, 94, 0.12)",
                  border: promoMsg
                    ? promoMsg.ok
                      ? "1px solid rgba(34, 197, 94, 0.25)"
                      : "1px solid rgba(239, 68, 68, 0.25)"
                    : "1px solid rgba(34, 197, 94, 0.25)",
                }}
              >
                <span>{promoMsg ? promoMsg.message : `${cart.promo} applied ✓`}</span>
                {cart.promo && (
                  <button
                    type="button"
                    onClick={() => {
                      cart.clearPromo();
                      setPromoMsg(null);
                    }}
                    style={{
                      border: "none",
                      background: "none",
                      color: "#6b7280",
                      fontSize: 12,
                      cursor: "pointer",
                      padding: "0 2px",
                      textDecoration: "underline",
                    }}
                    title="Remove promo code"
                  >
                    Remove
                  </button>
                )}
              </div>
            )}

            <div className="cart-totals">
              <div className="cart-total-row">
                <span>Subtotal</span>
                <span>{fmtPrice(cart.subtotal)}</span>
              </div>
              {cart.discount > 0 && (
                <div className="cart-total-row" style={{ color: "#166534", fontWeight: 600 }}>
                  <span>Discount {cart.promo ? `(${cart.promo})` : ""}</span>
                  <span>−{fmtPrice(cart.discount)}</span>
                </div>
              )}
              <div className="cart-total-row">
                <span>Shipping</span>
                <span>{cart.shipping === 0 ? "FREE" : fmtPrice(cart.shipping)}</span>
              </div>
              <div className="cart-total-row cart-total-final">
                <span>Total</span>
                <span>{fmtPrice(cart.total)}</span>
              </div>
            </div>

            <button type="button" className="cart-checkout-btn" onClick={handleCheckout}>
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </>
  );
}
