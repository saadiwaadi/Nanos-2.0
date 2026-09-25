"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { fmtPrice, FREE_SHIPPING_THRESHOLD } from "@/lib/cart";

export default function CartPage() {
  const cart = useCart();
  const [promoInput, setPromoInput] = useState("");
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (cart.items.length === 0) {
    return (
      <div className="page">
        <div className="wrap">
          <div className="breadcrumb">
            <Link href="/">Home</Link>
            <span className="sep">/</span>
            <span className="current">Cart</span>
          </div>

          <div className="empty-state">
            <div className="icon-circle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
            </div>
            <h2>Your cart is empty</h2>
            <p>
              Looks like you haven&apos;t added anything yet. Browse crocs and trousers built for your everyday rotation.
            </p>
            <Link href="/" className="btn btn-primary">
              Start Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const freeShipGap = FREE_SHIPPING_THRESHOLD - (cart.subtotal - cart.discount);

  return (
    <div className="page">
      <div className="wrap">
        <div className="breadcrumb">
          <Link href="/">Home</Link>
          <span className="sep">/</span>
          <span className="current">Cart</span>
        </div>

        <div className="category-hero" style={{ borderBottom: "none", paddingBottom: 0 }}>
          <h1>Your Cart</h1>
          <p>
            {cart.count} item{cart.count !== 1 ? "s" : ""} in your cart
          </p>
        </div>

        <div className="cart-layout">
          {/* Left: Cart Items */}
          <div className="cart-items">
            {cart.items.map((item) => (
              <div
                key={`${item.productId}|${item.color}|${item.size}`}
                className="cart-line"
              >
                <Link href={`/product/${item.productId}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.img} alt={item.name} />
                </Link>

                <div className="cart-line-info">
                  <h3>
                    <Link href={`/product/${item.productId}`}>{item.name}</Link>
                  </h3>
                  <div className="meta">
                    {item.color} · Size {item.size}
                  </div>
                  <div className="cart-line-actions">
                    <div className="qty-stepper">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() =>
                          cart.updateQty(item.productId, item.color, item.size, -1)
                        }
                      >
                        −
                      </button>
                      <span className="qty-val">{item.qty}</span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() =>
                          cart.updateQty(item.productId, item.color, item.size, 1)
                        }
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="remove-link"
                      onClick={() =>
                        cart.removeItem(item.productId, item.color, item.size)
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="cart-line-price">
                  {fmtPrice(item.price * item.qty)}
                </div>
              </div>
            ))}
          </div>

          {/* Right: Summary Box */}
          <div className="summary-box">
            <h3>Order Summary</h3>
            <div className="summary-row">
              <span>Subtotal</span>
              <span>{fmtPrice(cart.subtotal)}</span>
            </div>

            {cart.discount > 0 && (
              <div className="summary-row" style={{ color: "#166534", fontWeight: 600 }}>
                <span>Promo ({cart.promo})</span>
                <span>−{fmtPrice(cart.discount)}</span>
              </div>
            )}

            <div className="summary-row">
              <span>Shipping</span>
              <span>{cart.shipping === 0 ? "Free" : fmtPrice(cart.shipping)}</span>
            </div>

            {cart.shipping > 0 && freeShipGap > 0 && (
              <div className="free-ship-note">
                Add {fmtPrice(freeShipGap)} more for free shipping
              </div>
            )}

            <div className="promo-row">
              <input
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={async () => {
                  const res = await cart.applyPromo(promoInput);
                  setPromoMsg({ ok: res.ok, text: res.message });
                  if (res.ok) setPromoInput("");
                }}
              >
                Apply
              </button>
            </div>

            {promoMsg && (
              <div
                style={{
                  fontSize: 12.5,
                  marginTop: -6,
                  marginBottom: 10,
                  fontWeight: 600,
                  color: promoMsg.ok ? "#166534" : "#991b1b",
                }}
              >
                {promoMsg.text}
              </div>
            )}

            <div className="summary-row total">
              <span>Total</span>
              <span>{fmtPrice(cart.total)}</span>
            </div>

            <Link
              href="/checkout"
              className="btn btn-primary btn-block"
              style={{ marginTop: 18 }}
            >
              Proceed to Checkout
            </Link>
            <Link
              href="/"
              className="btn btn-outline btn-block"
              style={{ marginTop: 10 }}
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
