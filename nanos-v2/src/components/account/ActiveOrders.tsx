"use client";

import React from "react";
import Link from "next/link";
import { ActiveOrder } from "@/lib/account-summary";

interface ActiveOrdersProps {
  orders: ActiveOrder[];
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

function mapStatusBadge(order: ActiveOrder): { label: string; bg: string; color: string } {
  const raw = (order.courierStatusRaw || "").toLowerCase();
  const courierStatus = (order.courierBookingStatus || "").toLowerCase();
  const status = (order.status || "").toLowerCase();

  if (raw.includes("out for delivery")) {
    return { label: "Out for Delivery", bg: "var(--lime)", color: "var(--black)" };
  }
  if (raw.includes("transit") || raw.includes("picked") || raw.includes("dispatch")) {
    return { label: "In Transit", bg: "var(--charcoal)", color: "var(--white)" };
  }
  if (courierStatus === "booked" || order.trackingNumber) {
    return { label: "Courier Booked", bg: "var(--charcoal)", color: "var(--white)" };
  }
  if (status === "confirmed") {
    return { label: "Confirmed", bg: "var(--lime)", color: "var(--black)" };
  }
  if (status === "on_hold") {
    return { label: "On Hold", bg: "#fef3c7", color: "#92400e" };
  }
  return { label: "Processing", bg: "var(--stone)", color: "var(--charcoal)" };
}

export function ActiveOrders({ orders }: ActiveOrdersProps) {
  return (
    <div style={{ marginBottom: 36 }}>
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
          Active Orders ({orders.length})
        </h3>
      </div>

      {orders.length === 0 ? (
        <div
          style={{
            background: "var(--white)",
            border: "1px dashed var(--stone)",
            borderRadius: 8,
            padding: "24px 20px",
            textAlign: "center",
            color: "#666",
            fontSize: 13.5,
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#999"
            strokeWidth="1.5"
            style={{ margin: "0 auto 8px", display: "block" }}
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 14 14" />
          </svg>
          <div style={{ fontWeight: 600, color: "var(--black)", marginBottom: 2 }}>
            No orders currently in progress
          </div>
          <div style={{ fontSize: 12.5 }}>
            When you place a new order, you can track its live fulfillment and courier journey here.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {orders.map((order) => {
            const badge = mapStatusBadge(order);

            return (
              <div
                key={order.id}
                style={{
                  background: "var(--white)",
                  border: "1px solid var(--stone)",
                  borderRadius: 8,
                  padding: "18px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  transition: "border-color 0.15s ease",
                }}
              >
                {/* Order Top Bar */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          fontFamily: "var(--font-head)",
                          fontWeight: 700,
                          fontSize: 15,
                          color: "var(--black)",
                        }}
                      >
                        Order #{order.shortId}
                      </span>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 3,
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.02em",
                          background: badge.bg,
                          color: badge.color,
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "#666", marginTop: 4 }}>
                      Placed on {formatDate(order.createdAt)} · {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontFamily: "var(--font-head)",
                        fontWeight: 700,
                        fontSize: 16,
                        color: "var(--black)",
                      }}
                    >
                      {formatPrice(order.total)}
                    </div>
                    {order.shipping === 0 ? (
                      <span style={{ fontSize: 11, color: "green", fontWeight: 600 }}>Free Shipping</span>
                    ) : (
                      <span style={{ fontSize: 11, color: "#777" }}>incl. PKR 250 shipping</span>
                    )}
                  </div>
                </div>

                {/* Items preview thumbnails */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    overflowX: "auto",
                    paddingBottom: 4,
                  }}
                >
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: "var(--cream, #fdfbf7)",
                        border: "1px solid var(--stone)",
                        borderRadius: 6,
                        padding: "6px 10px",
                        flexShrink: 0,
                      }}
                    >
                      {item.hero ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={item.hero}
                          alt={item.name}
                          style={{
                            width: 32,
                            height: 32,
                            objectFit: "cover",
                            borderRadius: 4,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 4,
                            background: "var(--stone)",
                          }}
                        />
                      )}
                      <div style={{ fontSize: 12, lineHeight: 1.2 }}>
                        <div style={{ fontWeight: 600, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.name}
                        </div>
                        <div style={{ color: "#666", fontSize: 11 }}>
                          {item.color} · {item.size} · ×{item.quantity}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Footer */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: 10,
                    borderTop: "1px solid var(--stone)",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  {order.trackingNumber ? (
                    <div style={{ fontSize: 12, color: "#555" }}>
                      Tracking: <strong style={{ color: "var(--black)" }}>{order.trackingNumber}</strong>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#777" }}>
                      Courier booking being prepared
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10 }}>
                    {order.trackingUrl ? (
                      <a
                        href={order.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary btn-sm"
                        style={{
                          height: 36,
                          minHeight: 36,
                          padding: "6px 14px",
                          fontSize: 12.5,
                          fontWeight: 700,
                          textDecoration: "none",
                        }}
                      >
                        Track Shipment ↗
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="btn btn-outline btn-sm"
                        style={{
                          height: 36,
                          minHeight: 36,
                          padding: "6px 14px",
                          fontSize: 12.5,
                          opacity: 0.6,
                        }}
                      >
                        Preparing Courier
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
