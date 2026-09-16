"use client";

import { createContext, useContext, ReactNode } from "react";
import { useCart as useCartStore } from "@/lib/cart";

type CartContextType = ReturnType<typeof useCartStore>;

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const cart = useCartStore();
  return <CartContext.Provider value={cart}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
