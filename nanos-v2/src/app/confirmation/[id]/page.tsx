"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { fmtPrice } from "@/lib/cart";
import { trackMeta } from "@/lib/fpixel";

interface OrderItemData {
  productId?: string;
  name: string;
  sku: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
}

interface OrderData {
  id: string;
  status: string;
  total: number;
  subtotal: number;
  discount: number;
  shipping: number;
  shippingInfo: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    postal?: string;
  };
  payment: string;
  createdAt: string;
  items: OrderItemData[];
}

export default function ConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email");
  const auth = useAuth();

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchOrder() {
      try {
        const headers: Record<string, string> = {};
        if (auth.token) {
          headers["Authorization"] = `Bearer ${auth.token}`;
        }

        let url = `/api/orders/${id}`;
        if (emailParam) {
          url += `?email=${encodeURIComponent(emailParam)}`;
        }

        const res = await fetch(url, { headers });
        if (!res.ok) {
          setError(true);
          setLoading(false);
          return;
        }

        const data = await res.json();
        setOrder(data);

        // Fire Purchase Meta Pixel Event
        try {
          const storageKey = `meta_purchase_fired_${data.id}`;
          if (typeof window !== "undefined" && !sessionStorage.getItem(storageKey)) {
            sessionStorage.setItem(storageKey, "true");
            const items = data.items || [];
            const contentIds = items.map((i: any) => i.productId).filter(Boolean);
            const contents = items.map((i: any) => ({
              id: i.productId,
              quantity: i.quantity || 1,
              item_price: i.unitPrice || 0,
            }));
            const numItems = items.reduce((acc: number, i: any) => acc + (i.quantity || 1), 0);

            trackMeta(
              "Purchase",
              {
                value: data.total,
                currency: "PKR",
                content_type: "product",
                content_ids: contentIds,
                contents,
                num_items: numItems,
              },
              data.id
            );
          }
        } catch {
          // Ignore tracking error
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchOrder();
  }, [id, emailParam, auth.token]);

  if (loading) {
    return (
      <div className="page" style={{ padding: "80px 20px", textAlign: "center" }}>
        <div style={{ textAlign: "center", color: "#777", fontSize: 14 }}>
          Loading order details...
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="page">
        <div className="wrap">
          <div className="empty-state" style={{ padding: "80px 20px" }}>
            <h2>Order Not Found</h2>
            <p>We couldn&apos;t find an order matching that confirmation ID.</p>
            <Link href="/" className="btn btn-primary">
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const shortId = "#" + order.id.slice(0, 8).toUpperCase();
  const customerName = order.shippingInfo?.name || "Customer";
  const customerPhone = order.shippingInfo?.phone || "";

  return (
    <div className="page">
      <div className="confirm-wrap">
        {/* Checkmark Circle */}
        <div className="confirm-check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 12 4 10" />
          </svg>
        </div>

        <h1>Order Confirmed!</h1>
        <p style={{ color: "#555", fontSize: 15, marginBottom: 6 }}>
          Thank you, {customerName}. Your order has been received.
        </p>
        {customerPhone && (
          <p style={{ color: "#777", fontSize: 13.5 }}>
            We&apos;ll contact you on {customerPhone} to confirm delivery.
          </p>
        )}

        {/* Order ID & Total Box */}
        <div className="order-id-box">
          <div>
            <div style={{ fontSize: 12, color: "#777", marginBottom: 2 }}>Order ID</div>
            <strong style={{ fontFamily: "var(--font-head)", fontSize: 16 }}>{shortId}</strong>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "#777", marginBottom: 2 }}>Total</div>
            <strong style={{ fontSize: 16 }}>{fmtPrice(order.total)}</strong>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href={auth.isLoggedIn ? "/account" : "/login"}
            className="btn btn-secondary"
          >
            Track Your Order
          </Link>
          <Link href="/" className="btn btn-outline">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
