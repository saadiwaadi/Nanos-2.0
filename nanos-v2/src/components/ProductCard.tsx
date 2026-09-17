"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { fmtPrice } from "@/lib/cart";

export interface ProductCardProps {
  id: string;
  sku: string;
  name: string;
  price: number;
  oldPrice?: number | null;
  hero: string;
  tag?: string | null;
  isSale?: boolean;
  category: string;
  colors?: { name: string; hex: string }[];
  sizes?: string[];
}

export function ProductCard({
  id,
  name,
  price,
  oldPrice,
  hero,
  tag,
  isSale,
  category,
  colors = [],
  sizes = [],
}: ProductCardProps) {
  const [wished, setWished] = useState(false);
  const [added, setAdded] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [animCoords, setAnimCoords] = useState<{ startX: number; startY: number } | null>(null);
  const cart = useCart();

  function handleQuickAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (animating) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setAnimCoords({
      startX: rect.left + rect.width / 2,
      startY: rect.top + rect.height / 2,
    });
    setAnimating(true);

    const selectedColor = colors[0]?.name || "Standard";
    const selectedSize = sizes[0] || "Standard";

    // 600ms flight animation delay before cart badge count increments
    setTimeout(() => {
      cart.addItem(
        {
          productId: id,
          name,
          color: selectedColor,
          size: selectedSize,
          price,
          img: hero,
        },
        1
      );
      setAdded(true);
      setAnimating(false);
      setAnimCoords(null);
      setTimeout(() => setAdded(false), 1500);
    }, 600);
  }

  return (
    <div className="product-card">
      {animating && animCoords && (
        <div
          className="fly-to-cart-dot"
          style={
            {
              "--start-x": `${animCoords.startX}px`,
              "--start-y": `${animCoords.startY}px`,
            } as React.CSSProperties
          }
        />
      )}

      <div className="product-thumb">
        <Link href={`/product/${id}`} className="w-full h-full block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero} alt={name} />
        </Link>

        {/* Badges */}
        <div className="badges">
          {tag === "NEW" && <span className="badge badge-new">NEW</span>}
          {tag === "BESTSELLER" && <span className="badge badge-bestseller">BESTSELLER</span>}
          {isSale && <span className="badge badge-sale">SALE</span>}
        </div>

        {/* Wishlist Button */}
        <button
          type="button"
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          className={`wish-btn ${wished ? "active" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setWished(!wished);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
          </svg>
        </button>
      </div>

      <div className="product-info">
        <h3>
          <Link href={`/product/${id}`}>{name}</Link>
        </h3>
        <div className="variant">
          {category === "crocs" ? "Crocs" : "Trousers"}
          {colors.length > 0 ? ` · ${colors.length} colors` : ""}
        </div>

        <div className="price-row">
          <span className="price">{fmtPrice(price)}</span>
          {isSale && oldPrice && (
            <span className="price-old">{fmtPrice(oldPrice)}</span>
          )}
        </div>

        {colors.length > 0 && (
          <div className="swatches">
            {colors.slice(0, 4).map((c) => (
              <div
                key={c.name}
                className="swatch"
                style={{ background: c.hex }}
                title={c.name}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={handleQuickAdd}
          className={`quick-add ${added ? "added" : ""}`}
        >
          {added ? "Added ✓" : "+ Quick Add"}
        </button>
      </div>
    </div>
  );
}
