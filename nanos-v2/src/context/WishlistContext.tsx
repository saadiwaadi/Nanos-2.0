"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface WishlistItem {
  productId: string;
  name: string;
  price: number;
  oldPrice?: number | null;
  img: string;
  color?: string;
  size?: string;
  category?: string;
}

interface WishlistContextType {
  items: WishlistItem[];
  toggleWishlist: (item: WishlistItem) => boolean; // returns true if now wished
  isWished: (productId: string) => boolean;
  removeItem: (productId: string) => void;
  count: number;
}

const WishlistContext = createContext<WishlistContextType | null>(null);

const STORAGE_KEY = "nanos_wishlist_v1";

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setItems(JSON.parse(raw));
      }
    } catch {}
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items, mounted]);

  const isWished = (productId: string): boolean => {
    return items.some((i) => i.productId === productId);
  };

  const toggleWishlist = (item: WishlistItem): boolean => {
    let nowWished = false;
    setItems((prev) => {
      const exists = prev.some((i) => i.productId === item.productId);
      if (exists) {
        nowWished = false;
        return prev.filter((i) => i.productId !== item.productId);
      } else {
        nowWished = true;
        return [item, ...prev];
      }
    });
    return nowWished;
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  return (
    <WishlistContext.Provider
      value={{
        items,
        toggleWishlist,
        isWished,
        removeItem,
        count: items.length,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    // Fallback safe dummy if used outside provider
    return {
      items: [],
      toggleWishlist: () => false,
      isWished: () => false,
      removeItem: () => {},
      count: 0,
    };
  }
  return ctx;
}
