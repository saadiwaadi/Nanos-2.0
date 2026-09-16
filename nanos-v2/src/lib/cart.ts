"use client";

import { useEffect, useState } from "react";

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

type CartState = {
  items: CartItem[];
  promo: string | null;
};

function load(): CartState {
  if (typeof window === "undefined") return { items: [], promo: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: [], promo: null };
    const parsed = JSON.parse(raw) as CartState;
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      promo: typeof parsed.promo === "string" ? parsed.promo : null,
    };
  } catch {
    return { items: [], promo: null };
  }
}

function save(state: CartState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useCart() {
  const [state, setState] = useState<CartState>({ items: [], promo: null });

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
  const promoValid = state.promo === PROMO_CODE && items.length > 0;
  const discount = promoValid ? Math.round(subtotal * PROMO_DISCOUNT) : 0;
  const afterDiscount = subtotal - discount;
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

    applyPromo(code: string): { ok: boolean; message: string } {
      const cur = load();
      const normalized = code.trim().toUpperCase();
      if (cur.items.length === 0) {
        return { ok: false, message: "Add something to your cart first." };
      }
      if (normalized !== PROMO_CODE) {
        return { ok: false, message: `Code "${code}" is not valid.` };
      }
      cur.promo = normalized;
      save(cur);
      return { ok: true, message: `${PROMO_CODE} applied — 10% off.` };
    },

    clearPromo() {
      const cur = load();
      cur.promo = null;
      save(cur);
    },

    clear() {
      save({ items: [], promo: null });
    },
  };
}

export function fmtPrice(n: number): string {
  return "PKR " + n.toLocaleString("en-PK");
}
