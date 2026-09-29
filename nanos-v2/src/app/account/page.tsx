"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { OrderSummary, OrderStatus } from "@/lib/types";
import { OverviewTab } from "@/components/account/OverviewTab";
import { useSWR } from "@/lib/swr";

function getInitials(name?: string): string {
  if (!name) return "N";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatPrice(n: number): string {
  return "PKR " + n.toLocaleString("en-PK");
}

function getStatusBadgeStyle(status: OrderStatus | string): { bg: string; color: string } {
  const s = String(status).toUpperCase();
  switch (s) {
    case "CONFIRMED":
      return { bg: "var(--lime)", color: "var(--black)" };
    case "SHIPPED":
      return { bg: "var(--charcoal)", color: "var(--off-white)" };
    case "DELIVERED":
      return { bg: "var(--black)", color: "var(--off-white)" };
    case "CANCELLED":
      return { bg: "#fee2e2", color: "#991b1b" };
    case "PENDING":
    default:
      return { bg: "var(--stone)", color: "var(--charcoal)" };
  }
}

export default function AccountPage() {
  const auth = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "orders" | "wishlist" | "details">("overview");
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");

  const fetchOrders = useCallback(async () => {
    let token: string | null = null;
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("nanos_auth_v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        token = parsed.token || null;
      }
    }

    if (!token) {
      throw new Error("Not authenticated");
    }

    const res = await fetch("/api/orders", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error("Failed to load order history");
    }

    const data = await res.json();
    return (data.orders || []) as OrderSummary[];
  }, []);

  // SWR for Order History: instant render from cache, 60s background revalidation, quiet error handling
  const {
    data: cachedOrders,
    isLoading: ordersLoading,
    error: ordersErrorObj,
  } = useSWR<OrderSummary[]>(
    auth.isLoggedIn ? "account:orders" : null,
    fetchOrders,
    { staleTime: 60 * 1000 }
  );

  const orders = cachedOrders || [];
  const ordersError = ordersErrorObj && !cachedOrders ? (ordersErrorObj.message || "An error occurred fetching orders.") : null;

  useEffect(() => {
    if (!auth.isLoggedIn) {
      router.push("/login");
      return;
    }

    if (auth.user) {
      setNameInput(auth.user.name || "");
      setEmailInput(auth.user.email || "");
    }
  }, [auth.isLoggedIn, auth.user, router]);

  if (!auth.isLoggedIn || !auth.user) {
    return null;
  }

  const initials = getInitials(auth.user.name);

  function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    console.log("Save account details:", { name: nameInput, email: emailInput });
  }

  function handleLogout() {
    auth.logout();
    router.push("/");
  }

  return (
    <div className="page" style={{ background: "var(--cream, #fdfbf7)", minHeight: "80vh" }}>
      <div className="wrap account-wrap">
        {/* Account Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            paddingBottom: 24,
            borderBottom: "1px solid var(--stone)",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              minWidth: 54,
              borderRadius: "50%",
              background: "var(--black)",
              color: "var(--lime)",
              fontFamily: "var(--font-head)",
              fontSize: 19,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              letterSpacing: "0.02em",
            }}
          >
            {initials}
          </div>
          <div>
            <h1
              style={{
                fontFamily: "var(--font-head)",
                fontSize: 22,
                fontWeight: 700,
                color: "var(--black)",
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              {auth.user.name}
            </h1>
            <p style={{ color: "#666", fontSize: 13, margin: "3px 0 0" }}>{auth.user.email}</p>
          </div>
        </div>

        {/* Account Grid */}
        <div className="account-grid">
          {/* Nav */}
          <nav className="account-nav" aria-label="Account navigation">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`account-nav-btn ${activeTab === "overview" ? "active" : ""}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <span>Overview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("orders")}
              className={`account-nav-btn ${activeTab === "orders" ? "active" : ""}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              <span>Orders {orders.length > 0 && `(${orders.length})`}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("wishlist")}
              className={`account-nav-btn ${activeTab === "wishlist" ? "active" : ""}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.72-8.72 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span>Wishlist</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={`account-nav-btn ${activeTab === "details" ? "active" : ""}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Account Details</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="account-nav-btn"
              style={{ color: "#c0392b" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Log Out</span>
            </button>
          </nav>

          {/* Tab Content */}
          <div>
            {/* 1. OVERVIEW TAB */}
            {activeTab === "overview" && (
              <OverviewTab
                userName={auth.user.name || undefined}
                onNavigateTab={(tab) => setActiveTab(tab as any)}
              />
            )}

            {/* 2. ORDERS TAB */}
            {activeTab === "orders" && (
              <section className="orders-section">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h2 style={{ fontFamily: "var(--font-head)", fontSize: 20, fontWeight: 700, margin: 0 }}>
                    Order History
                  </h2>
                </div>

                {ordersLoading && orders.length === 0 ? (
                  <div style={{ padding: "32px 0", color: "#666", fontSize: 14 }}>
                    Loading order history...
                  </div>
                ) : ordersError ? (
                  <div style={{ padding: "16px", background: "#fee2e2", color: "#991b1b", borderRadius: 6, fontSize: 14 }}>
                    {ordersError}
                  </div>
                ) : orders.length === 0 ? (
                  <div className="empty-state" style={{ padding: "40px 20px" }}>
                    <div className="icon-circle">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                      </svg>
                    </div>
                    <h2>No orders yet</h2>
                    <p>When you place an order, it&apos;ll show up here.</p>
                    <Link href="/products" className="btn btn-primary">
                      Start shopping
                    </Link>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {orders.map((order) => {
                      const badgeStyle = getStatusBadgeStyle(order.status);
                      const shortId = order.id.replace("ord_", "").slice(0, 8);

                      return (
                        <div
                          key={order.id}
                          style={{
                            border: "1px solid var(--stone)",
                            borderRadius: 8,
                            padding: 20,
                            background: "var(--white)",
                          }}
                        >
                          {/* Order Header */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: 8,
                            }}
                          >
                            <span style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 16 }}>
                              Order #{shortId}
                            </span>
                            <span
                              style={{
                                padding: "4px 10px",
                                borderRadius: 4,
                                fontSize: 12,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                background: badgeStyle.bg,
                                color: badgeStyle.color,
                              }}
                            >
                              {order.status}
                            </span>
                          </div>

                          <div style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
                            {formatDate(order.createdAt)}
                          </div>

                          <hr style={{ border: "none", borderTop: "1px solid var(--stone)", marginBottom: 16 }} />

                          {/* Order Items */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                            {order.orderItems.map((item) => (
                              <div
                                key={item.id}
                                style={{ display: "flex", alignItems: "center", gap: 16 }}
                              >
                                {item.product?.hero ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img
                                    src={item.product.hero}
                                    alt={item.product.name}
                                    style={{
                                      width: 48,
                                      height: 48,
                                      objectFit: "cover",
                                      borderRadius: 6,
                                      background: "var(--stone)",
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: 48,
                                      height: 48,
                                      borderRadius: 6,
                                      background: "var(--stone)",
                                    }}
                                  />
                                )}
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                                    {item.product?.name || "Product"}
                                  </div>
                                  {(item.color || item.size) && (
                                    <div style={{ fontSize: 12, color: "#666" }}>
                                      {item.color} {item.size ? `· ${item.size}` : ""}
                                    </div>
                                  )}
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>
                                  ×{item.quantity}
                                </div>
                              </div>
                            ))}
                          </div>

                          <hr style={{ border: "none", borderTop: "1px solid var(--stone)", marginBottom: 16 }} />

                          {/* Order Summary Footer */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 14,
                              fontWeight: 600,
                            }}
                          >
                            <span>Total: {formatPrice(order.totalAmount)}</span>
                            <span style={{ color: "#666", fontWeight: 500 }}>
                              Shipping: {order.shippingFee === 0 ? "FREE" : formatPrice(order.shippingFee)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* 3. WISHLIST TAB */}
            {activeTab === "wishlist" && (
              <div className="empty-state" style={{ padding: "40px 20px" }}>
                <div className="icon-circle">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.72-8.72 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </div>
                <h2>Your wishlist is empty</h2>
                <p>Save items you love by tapping the heart icon.</p>
                <Link href="/products" className="btn btn-primary">
                  Browse Products
                </Link>
              </div>
            )}

            {/* 4. DETAILS TAB */}
            {activeTab === "details" && (
              <div className="form-section">
                <h3>Account Details</h3>
                <form onSubmit={handleSaveDetails} className="auth-form">
                  <div className="form-row">
                    <div className="form-group full">
                      <label htmlFor="acc-name">Full Name</label>
                      <input
                        type="text"
                        id="acc-name"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group full">
                      <label htmlFor="acc-email">Email Address</label>
                      <input
                        type="email"
                        id="acc-email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <button type="submit" className="btn btn-secondary">
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
