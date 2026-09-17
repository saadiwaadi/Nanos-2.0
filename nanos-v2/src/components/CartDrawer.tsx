"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { fmtPrice } from "@/lib/cart";

export function CartDrawer() {
  const router = useRouter();
  const cart = useCart();
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

  function handleApplyPromo(e: React.FormEvent) {
    e.preventDefault();
    if (!promoInput.trim()) return;
    const res = cart.applyPromo(promoInput);
    setPromoMsg(res);
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
            <div className="cart-empty">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                style={{ width: 48, height: 48, margin: "0 auto 16px", color: "var(--stone)" }}
              >
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              <h3 style={{ fontFamily: "var(--font-head)", fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
                Your cart is empty
              </h3>
              <p style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
                Explore our collection to find your pair.
              </p>
              <button
                type="button"
                className="cart-checkout-btn"
                style={{ maxWidth: 200, margin: "0 auto" }}
                onClick={() => {
                  cart.closeCart();
                  router.push("/products");
                }}
              >
                Shop Now →
              </button>
            </div>
          ) : (
            cart.items.map((item) => (
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
            ))
          )}
        </div>

        {/* Footer */}
        {cart.items.length > 0 && (
          <div className="cart-drawer-footer">
            <form onSubmit={handleApplyPromo} className="promo-row">
              <input
                type="text"
                className="promo-input"
                placeholder="Promo code (NANOS10)"
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
                  color: promoMsg ? (promoMsg.ok ? "var(--lime)" : "#d64545") : "var(--lime)",
                }}
              >
                {promoMsg ? promoMsg.message : "NANOS10 applied — 10% off ✓"}
              </div>
            )}

            <div className="cart-totals">
              <div className="cart-total-row">
                <span>Subtotal</span>
                <span>{fmtPrice(cart.subtotal)}</span>
              </div>
              {cart.discount > 0 && (
                <div className="cart-total-row" style={{ color: "var(--lime)" }}>
                  <span>Discount (10%)</span>
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
              Proceed to Checkout →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
