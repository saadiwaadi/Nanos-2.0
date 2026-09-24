"use client";

import { useEffect, useState } from "react";
import { trackMeta } from "@/lib/fpixel";

export const PROMO_CODE = "NANOS10";
export const PROMO_DISCOUNT = 0.1; // −10%
export const FREE_SHIPPING_THRESHOLD = 5000;
export const SHIPPING_FLAT = 250;
export const STORAGE_KEY = "nanos_cart_v1";
const CHANGE_EVENT = "nanos-cart-changed";

export type CartItem = {
  productId: string;
  name: string;
  color: string;
  size: string;
  price: number;
  img: string;
  qty: number;
};

export type PromoInfo = {
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  minOrderAmount?: number;
};

type CartState = {
  items: CartItem[];
  promo: string | null;
  promoInfo?: PromoInfo | null;
};

function load(): CartState {
  if (typeof window === "undefined") return { items: [], promo: null, promoInfo: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: [], promo: null, promoInfo: null };
    const parsed = JSON.parse(raw) as CartState;
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      promo: typeof parsed.promo === "string" ? parsed.promo : null,
      promoInfo: parsed.promoInfo && typeof parsed.promoInfo === "object" ? parsed.promoInfo : null,
    };
  } catch {
    return { items: [], promo: null, promoInfo: null };
  }
}

function save(state: CartState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useCart() {
  const [state, setState] = useState<CartState>({ items: [], promo: null, promoInfo: null });

  useEffect(() => {
    const sync = () => setState(load());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const items = state.items;
  const count = items.reduce((n, i) => n + i.qty, 0);
  const subtotal = items.reduce((n, i) => n + i.qty * i.price, 0);

  const promoInfo = state.promoInfo;
  let promoValid = Boolean(state.promo && items.length > 0);
  let discount = 0;

  if (promoValid && promoInfo && state.promo === promoInfo.code) {
    if (promoInfo.minOrderAmount && subtotal < promoInfo.minOrderAmount) {
      promoValid = false;
      discount = 0;
    } else if (promoInfo.discountType === "fixed") {
      discount = Math.min(subtotal, Math.round(promoInfo.discountValue));
    } else {
      const rate = Math.min(100, Math.max(0, promoInfo.discountValue)) / 100;
      discount = Math.round(subtotal * rate);
    }
  } else if (promoValid && state.promo) {
    // Default fallback 10%
    discount = Math.round(subtotal * 0.1);
  } else {
    promoValid = false;
    discount = 0;
  }

  const afterDiscount = Math.max(0, subtotal - discount);
  const shipping =
    items.length === 0 || afterDiscount >= FREE_SHIPPING_THRESHOLD
      ? 0
      : SHIPPING_FLAT;
  const total = afterDiscount + shipping;

  return {
    items,
    count,
    subtotal,
    promoValid,
    discount,
    afterDiscount,
    shipping,
    total,
    promo: promoValid ? state.promo : null,
    promoInfo: promoValid ? state.promoInfo : null,

    addItem(item: Omit<CartItem, "qty">, qty = 1) {
      const cur = load();
      const key = (i: CartItem) => `${i.productId}|${i.color}|${i.size}`;
      const targetKey = key(item as CartItem);
      const existing = cur.items.find((i) => key(i) === targetKey);
      if (existing) {
        existing.qty += qty;
      } else {
        cur.items.push({ ...item, qty });
      }
      save(cur);

      try {
        const eventId = crypto.randomUUID();
        trackMeta(
          "AddToCart",
          {
            content_ids: [item.productId],
            content_name: item.name,
            content_type: "product",
            value: item.price * qty,
            currency: "PKR",
            quantity: qty,
          },
          eventId
        );
      } catch {
        // Ignore tracking errors
      }
    },

    updateQty(productId: string, color: string, size: string, delta: number) {
      const cur = load();
      const it = cur.items.find(
        (i) => i.productId === productId && i.color === color && i.size === size
      );
      if (!it) return;
      it.qty += delta;
      if (it.qty <= 0) {
        cur.items = cur.items.filter((x) => x !== it);
      }
      if (cur.items.length === 0) {
        cur.promo = null;
      }
      save(cur);
    },

    removeItem(productId: string, color: string, size: string) {
      const cur = load();
      cur.items = cur.items.filter(
        (i) =>
          !(
            i.productId === productId &&
            i.color === color &&
            i.size === size
          )
      );
      if (cur.items.length === 0) {
        cur.promo = null;
      }
      save(cur);
    },

    async applyPromo(code: string): Promise<{ ok: boolean; message: string }> {
      const cur = load();
      const normalized = code.trim().toUpperCase();
      if (cur.items.length === 0) {
        return { ok: false, message: "Add something to your cart first." };
      }
      if (!normalized) {
        return { ok: false, message: "Please enter a promo code." };
      }

      const curSubtotal = cur.items.reduce((n, i) => n + i.qty * i.price, 0);

      try {
        const res = await fetch("/api/promo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: normalized, subtotal: curSubtotal }),
        });
        const data = await res.json();
        if (data.valid) {
          cur.promo = normalized;
          cur.promoInfo = {
            code: normalized,
            discountType: data.discountType || "percent",
            discountValue: typeof data.discountValue === "number" ? data.discountValue : 10,
            minOrderAmount: typeof data.minOrderAmount === "number" ? data.minOrderAmount : 0,
          };
          save(cur);
          return { ok: true, message: data.message || `${normalized} applied.` };
        } else {
          return { ok: false, message: data.message || `Code "${code}" is not valid.` };
        }
      } catch {
        // Fallback for offline/local if promo matches NANOS10
        if (normalized === PROMO_CODE) {
          cur.promo = normalized;
          cur.promoInfo = {
            code: normalized,
            discountType: "percent",
            discountValue: 10,
          };
          save(cur);
          return { ok: true, message: `${PROMO_CODE} applied — 10% off.` };
        }
        return { ok: false, message: `Code "${code}" is not valid.` };
      }
    },

    clearPromo() {
      const cur = load();
      cur.promo = null;
      cur.promoInfo = null;
      save(cur);
    },

    clear() {
      save({ items: [], promo: null, promoInfo: null });
    },
  };
}

export function fmtPrice(n: number): string {
  return "PKR " + n.toLocaleString("en-PK");
}
