"use client";

import { useCart } from "@/context/CartContext";

export function CartBadge() {
  const { count } = useCart();

  if (count <= 0) return null;

  return <span className="cart-count">{count}</span>;
}
