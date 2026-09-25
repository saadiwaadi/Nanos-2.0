"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { fmtPrice } from "@/lib/cart";
import { trackMeta } from "@/lib/fpixel";

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift();
  return undefined;
}

export default function CheckoutPage() {
  const router = useRouter();
  const cart = useCart();
  const auth = useAuth();

  const [initiateCheckoutEventId] = useState(() => crypto.randomUUID());
  const hasTrackedRef = useRef(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");

  const [createAccount, setCreateAccount] = useState(false);
  const [password, setPassword] = useState("");

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const submittingRef = useRef(false);
  const isOrderPlacedRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [promoInput, setPromoInput] = useState("");
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    // If order was successfully placed, don't trigger the empty cart redirect to home
    if (isOrderPlacedRef.current) return;

    if (cart.items.length === 0) {
      router.push("/");
      return;
    }

    if (!hasTrackedRef.current && cart.items.length > 0) {
      hasTrackedRef.current = true;
      trackMeta(
        "InitiateCheckout",
        {
          content_ids: cart.items.map((i) => i.productId),
          content_type: "product",
          currency: "PKR",
          value: cart.total,
          num_items: cart.count,
        },
        initiateCheckoutEventId
      );
    }
  }, [cart.items.length, initiateCheckoutEventId, router]);

  useEffect(() => {
    if (auth.user) {
      if (auth.user.name && !name) setName(auth.user.name);
      if (auth.user.email && !email) setEmail(auth.user.email);
    }
  }, [auth.user, name, email]);

  const phoneDigits = (phone.match(/\d/g) || []).length;
  const isPhoneValid = phoneDigits >= 10;
  const isAddressValid = address.trim().length >= 5;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isNameValid = name.trim().length >= 2;
  const isCityValid = city.trim().length > 0;
  const isPostalValid = postal.trim().length >= 3;
  const isPasswordValid = !createAccount || password.length >= 8;

  const isFormValid =
    isNameValid &&
    isPhoneValid &&
    isEmailValid &&
    isAddressValid &&
    isCityValid &&
    isPostalValid &&
    isPasswordValid &&
    cart.items.length > 0;

  function markTouched(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    // Double-submission guard (Ref + State)
    if (submittingRef.current || isSubmitting) {
      return;
    }

    if (!isFormValid) {
      setErrorMsg("Please fill out all required fields correctly before submitting.");
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      let currentToken = auth.token;

      // 1. Optional registration for guest
      if (!auth.isLoggedIn && createAccount) {
        if (!password || password.length < 8) {
          setErrorMsg("Password must be at least 8 characters long.");
          setIsSubmitting(false);
          submittingRef.current = false;
          return;
        }

        const regRes = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });

        const regData = await regRes.json();
        if (!regRes.ok) {
          setErrorMsg(regData.error?.message || regData.message || "Registration failed.");
          setIsSubmitting(false);
          submittingRef.current = false;
          return;
        }

        currentToken = regData.token;
        auth.login(regData.user, regData.token);
      }

      // 2. Submit Order
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (currentToken) {
        headers["Authorization"] = `Bearer ${currentToken}`;
      }

      const orderPayload = {
        items: cart.items.map((i) => ({
          productId: i.productId,
          color: i.color,
          size: i.size,
          qty: i.qty,
        })),
        shippingInfo: { name, phone, email, address, city, postal },
        promoCode: cart.promo || undefined,
        guestEmail: currentToken ? undefined : email,
        guestName: currentToken ? undefined : name,
        fbp: getCookie("_fbp"),
        fbc: getCookie("_fbc"),
        eventId: initiateCheckoutEventId,
      };

      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers,
        body: JSON.stringify(orderPayload),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        setErrorMsg(orderData.error?.message || orderData.message || "Failed to place order.");
        setIsSubmitting(false);
        submittingRef.current = false;
        return;
      }

      // 3. Mark order placed, clear cart & direct redirect to Confirmation
      isOrderPlacedRef.current = true;
      cart.clear();

      const redirectUrl = currentToken
        ? `/confirmation/${orderData.id}`
        : `/confirmation/${orderData.id}?email=${encodeURIComponent(email)}`;

      router.push(redirectUrl);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  }

  if (cart.items.length === 0 && !isOrderPlacedRef.current) {
    return null;
  }

  return (
    <div className="page">
      <div className="wrap">
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <Link href="/">Home</Link>
          <span className="sep">/</span>
          <Link href="/cart">Cart</Link>
          <span className="sep">/</span>
          <span className="current">Checkout</span>
        </div>

        {/* Hero Title */}
        <div className="category-hero" style={{ borderBottom: "none", paddingBottom: 0 }}>
          <h1>Checkout</h1>
        </div>

        {/* Steps Bar */}
        <div className="checkout-steps">
          <div className="checkout-step done">1. Cart</div>
          <div className="checkout-step active">2. Details &amp; Payment</div>
          <div className="checkout-step">3. Confirmation</div>
        </div>

        {/* Layout */}
        <div className="checkout-layout">
          {/* Left Column: Form */}
          <div>
            <form id="checkout-form" onSubmit={handleSubmit}>
              {/* Shipping Details */}
              <div className="form-section">
                <h3>Shipping Details</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="ship-name">Full Name</label>
                    <input
                      type="text"
                      id="ship-name"
                      required
                      placeholder="Ali Raza"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => markTouched("name")}
                    />
                    {touched.name && !isNameValid && (
                      <span style={{ color: "#c0392b", fontSize: 12, marginTop: 4 }}>
                        Please enter your full name (at least 2 characters)
                      </span>
                    )}
                  </div>
                  <div className="form-group">
                    <label htmlFor="ship-phone">Phone Number</label>
                    <input
                      type="tel"
                      id="ship-phone"
                      required
                      placeholder="03XX-XXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onBlur={() => markTouched("phone")}
                    />
                    {touched.phone && !isPhoneValid && (
                      <span style={{ color: "#c0392b", fontSize: 12, marginTop: 4 }}>
                        Phone number must contain at least 10 digits
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group full">
                    <label htmlFor="ship-email">Email Address</label>
                    <input
                      type="email"
                      id="ship-email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => markTouched("email")}
                    />
                    {touched.email && !isEmailValid && (
                      <span style={{ color: "#c0392b", fontSize: 12, marginTop: 4 }}>
                        Please enter a valid email address
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group full">
                    <label htmlFor="ship-address">Address</label>
                    <input
                      type="text"
                      id="ship-address"
                      required
                      placeholder="House #, Street, Area"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      onBlur={() => markTouched("address")}
                    />
                    {touched.address && !isAddressValid && (
                      <span style={{ color: "#c0392b", fontSize: 12, marginTop: 4 }}>
                        Address must be at least 5 characters long
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="ship-city">City</label>
                    <select
                      id="ship-city"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      onBlur={() => markTouched("city")}
                    >
                      <option value="">Select city</option>
                      <option>Lahore</option>
                      <option>Karachi</option>
                      <option>Islamabad</option>
                      <option>Faisalabad</option>
                      <option>Rawalpindi</option>
                      <option>Multan</option>
                    </select>
                    {touched.city && !isCityValid && (
                      <span style={{ color: "#c0392b", fontSize: 12, marginTop: 4 }}>
                        Please select a city
                      </span>
                    )}
                  </div>
                  <div className="form-group">
                    <label htmlFor="ship-postal">Postal Code</label>
                    <input
                      type="text"
                      id="ship-postal"
                      required
                      placeholder="54000"
                      value={postal}
                      onChange={(e) => setPostal(e.target.value)}
                      onBlur={() => markTouched("postal")}
                    />
                    {touched.postal && !isPostalValid && (
                      <span style={{ color: "#c0392b", fontSize: 12, marginTop: 4 }}>
                        Please enter a valid postal code
                      </span>
                    )}
                  </div>
                </div>

                {/* Optional Guest Registration */}
                {!auth.isLoggedIn && (
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #eee" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 500, fontSize: 14 }}>
                      <input
                        type="checkbox"
                        checked={createAccount}
                        onChange={(e) => setCreateAccount(e.target.checked)}
                      />
                      Create an account for faster checkout next time
                    </label>

                    {createAccount && (
                      <div className="form-row" style={{ marginTop: 12 }}>
                        <div className="form-group full">
                          <label htmlFor="account-password">Account Password</label>
                          <input
                            type="password"
                            id="account-password"
                            required={createAccount}
                            minLength={8}
                            placeholder="Min. 8 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                          />
                          {password.length > 0 && password.length < 8 && (
                            <span style={{ color: "#c0392b", fontSize: 12, marginTop: 4 }}>
                              Password must be at least 8 characters long
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div className="form-section">
                <h3>Payment</h3>
                <div className="pay-opt selected">
                  <input type="radio" checked readOnly disabled />
                  <div className="pay-label">Cash on Delivery</div>
                  <div className="pay-sub">Pay when your order arrives</div>
                </div>
              </div>
            </form>
          </div>

          {/* Right Column: Order Summary */}
          <div>
            <div className="summary-box">
              <h3>Order Summary</h3>
              {cart.items.map((item) => (
                <div
                  key={`${item.productId}|${item.color}|${item.size}`}
                  className="order-summary-mini"
                >
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>
                    {item.name} × {item.qty}
                    <span className="mini-meta">
                      {item.color} · Size {item.size}
                    </span>
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>
                    {fmtPrice(item.price * item.qty)}
                  </span>
                </div>
              ))}

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

              <div className="summary-row total">
                <span>Total</span>
                <span>{fmtPrice(cart.total)}</span>
              </div>

              {/* Promo Row */}
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

              {errorMsg && (
                <div
                  style={{
                    padding: "10px 14px",
                    backgroundColor: "#fdf2f2",
                    color: "#c0392b",
                    borderRadius: 4,
                    marginBottom: 14,
                    fontSize: 13,
                  }}
                >
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                form="checkout-form"
                disabled={!isFormValid || isSubmitting}
                className="btn btn-primary btn-block"
                style={{ marginTop: 18 }}
              >
                {isSubmitting ? "Placing your order..." : `Place Order — ${fmtPrice(cart.total)}`}
              </button>

              <Link
                href="/cart"
                className="btn btn-outline btn-block"
                style={{ marginTop: 10 }}
              >
                ← Back to Cart
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
