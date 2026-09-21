"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { fmtPrice } from "@/lib/cart";
import { trackMeta } from "@/lib/fpixel";
import type { ProductColor } from "@/lib/types";

interface ProductData {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  oldPrice?: number | null;
  description: string;
  rating: number;
  reviews: number;
  hero: string;
  isSale: boolean;
  tag?: string | null;
  colors: ProductColor[];
  sizes: string[];
  gallery: string[];
  productColors?: {
    id: string;
    name: string;
    hex: string;
    imagesJson: string;
    sortOrder: number;
  }[];
  stockLevels?: {
    id?: string;
    color: string;
    size: string;
    quantity: number;
  }[];
}

export function PdpActions({ product: p }: { product: ProductData }) {
  const [mounted, setMounted] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [color, setColor] = useState<string>(p.colors[0]?.name || "");
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [wished, setWished] = useState(false);
  const cart = useCart();

  useEffect(() => {
    setMounted(true);
    const eventId = crypto.randomUUID();
    trackMeta(
      "ViewContent",
      {
        content_ids: [p.id],
        content_name: p.name,
        content_category: p.category,
        content_type: "product",
        value: p.price,
        currency: "PKR",
      },
      eventId
    );
  }, [p.id, p.name, p.category, p.price]);

  // Determine active color gallery
  const selectedColorObj = p.productColors?.find(
    (c) => c.name.toLowerCase() === color.toLowerCase()
  );

  let colorImages: string[] = [];
  if (selectedColorObj) {
    try {
      const parsed = JSON.parse(selectedColorObj.imagesJson || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) {
        colorImages = parsed;
      }
    } catch {}
  }

  // Hero fallback: if empty or no color images, use main hero or first color's first image
  const firstColorImages = (() => {
    if (!p.productColors || p.productColors.length === 0) return [];
    try {
      const parsed = JSON.parse(p.productColors[0].imagesJson || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  const effectiveHero = p.hero || firstColorImages[0] || "/placeholder.jpg";

  const gallery = colorImages.length > 0 ? colorImages : p.gallery && p.gallery.length > 0 ? p.gallery : [effectiveHero];
  const displayedImage = activeImage || gallery[imgIdx] || effectiveHero;

  // Preload first image of next color options
  useEffect(() => {
    p.productColors?.forEach((c) => {
      try {
        const imgs = JSON.parse(c.imagesJson || "[]");
        if (Array.isArray(imgs) && imgs[0]) {
          const img = new window.Image();
          img.src = imgs[0];
        }
      } catch {}
    });
  }, [p.productColors]);

  // Stock lookup for selected color
  const stockForSelectedColor = (p.stockLevels || [])
    .filter((s) => s.color.toLowerCase() === color.toLowerCase())
    .reduce((acc, s) => {
      acc[s.size] = s.quantity;
      return acc;
    }, {} as Record<string, number>);

  function getStockForSize(sz: string): number {
    if (p.stockLevels && p.stockLevels.length > 0) {
      return stockForSelectedColor[sz] ?? 0;
    }
    return 999;
  }

  function handleAdd() {
    if (!size) return;
    const sizeStock = getStockForSize(size);
    if (sizeStock === 0) return;

    cart.addItem(
      {
        productId: p.id,
        name: p.name,
        color,
        size,
        price: p.price,
        img: displayedImage,
      },
      qty
    );

    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  function handleColorSelect(c: ProductColor) {
    setColor(c.name);
    setImgIdx(0);
    setActiveImage(null);

    // If currently selected size is out of stock in new color, clear size
    if (size && getStockForSize(size) === 0) {
      setSize(null);
    }
  }

  if (!mounted) {
    return (
      <div className="pdp" suppressHydrationWarning>
        <div className="pdp-gallery">
          <div className="pdp-main-image"><img src={effectiveHero} alt={p.name} /></div>
        </div>
        <div className="pdp-info">
          <h1>{p.name}</h1>
          <div className="pdp-sub">{p.category === 'crocs' ? 'Crocs' : 'Trousers'} · {p.colors.length} colors available</div>
          <div className="pdp-price-row"><span className="price">{fmtPrice(p.price)}</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="pdp" suppressHydrationWarning>
      {/* Left: Gallery */}
      <div className="pdp-gallery">
        <div className="pdp-main-image" style={{ transition: "opacity 0.2s ease" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={displayedImage} alt={p.name} />
        </div>
        {gallery.length > 1 && (
          <div className="pdp-thumbs">
            {gallery.map((g, i) => (
              <div
                key={`${g}-${i}`}
                className={`pdp-thumb ${!activeImage && i === imgIdx ? "active" : ""}`}
                onClick={() => {
                  setActiveImage(null);
                  setImgIdx(i);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g} alt="" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: Info Panel */}
      <div className="pdp-info">
        <h1>{p.name}</h1>
        <div className="pdp-sub">
          {p.category === "crocs" ? "Crocs" : "Trousers"} · {p.colors.length} colors available
        </div>

        <div className="pdp-price-row">
          <span className="price">{fmtPrice(p.price)}</span>
          {p.oldPrice && (
            <>
              <span className="price-old">{fmtPrice(p.oldPrice)}</span>
              <span className="badge badge-sale">SALE</span>
            </>
          )}
        </div>

        <div className="pdp-rating">
          <span>★ {p.rating}</span>
          <span>({p.reviews} reviews)</span>
        </div>

        {/* Color Option Group */}
        {p.colors.length > 0 && (
          <div className="option-group">
            <div className="label-row">
              <label className="title">Color</label>
              <span className="selected-val">{color}</span>
            </div>
            <div className="color-options">
              {p.colors.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  title={c.name}
                  aria-label={`Select color ${c.name}`}
                  className={`color-opt ${color === c.name ? "selected" : ""}`}
                  onClick={() => handleColorSelect(c)}
                >
                  <span className="swatch-inner" style={{ background: c.hex }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Size Option Group */}
        {p.sizes.length > 0 && (
          <div className="option-group">
            <div className="label-row">
              <label className="title">Size</label>
              <span className="selected-val">{size ?? "Select a size"}</span>
            </div>
            <div className="size-options">
              {p.sizes.map((s) => {
                const stk = getStockForSize(s);
                const isOutOfStock = stk === 0;
                const isLowStock = stk > 0 && stk <= 3;

                return (
                  <button
                    key={s}
                    type="button"
                    disabled={isOutOfStock}
                    aria-label={`Select size ${s}`}
                    className={`size-opt ${size === s ? "selected" : ""} ${isOutOfStock ? "out-of-stock" : ""}`}
                    style={{
                      opacity: isOutOfStock ? 0.35 : 1,
                      textDecoration: isOutOfStock ? "line-through" : "none",
                      cursor: isOutOfStock ? "not-allowed" : "pointer",
                      position: "relative",
                    }}
                    onClick={() => {
                      if (!isOutOfStock) setSize(s);
                    }}
                  >
                    {s}
                    {isLowStock && (
                      <span
                        style={{
                          fontSize: 10,
                          color: "#b5860b",
                          display: "block",
                          lineHeight: 1,
                          marginTop: 2,
                        }}
                      >
                        Only {stk} left
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quantity Row */}
        <div className="qty-row">
          <label className="title">Quantity</label>
          <div className="qty-stepper">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQty(Math.max(1, qty - 1))}
            >
              −
            </button>
            <span className="qty-val">{qty}</span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQty(qty + 1)}
            >
              +
            </button>
          </div>
        </div>

        {/* PDP Actions */}
        <div className="pdp-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!size}
            onClick={handleAdd}
          >
            {added
              ? "Added ✓"
              : !size
              ? "Select a size"
              : `Add to Cart — ${fmtPrice(p.price * qty)}`}
          </button>
          <button
            type="button"
            className={`wish-toggle ${wished ? "active" : ""}`}
            onClick={() => setWished(!wished)}
            aria-label="Wishlist toggle"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
            </svg>
          </button>
        </div>

        {added && (
          <div
            style={{
              fontSize: 13,
              color: "#5a8f00",
              marginTop: -16,
              marginBottom: 24,
              fontWeight: 600,
            }}
          >
            Added to cart ✓ — <Link href="/cart">view cart</Link>
          </div>
        )}

        {/* Perks Box */}
        <div className="pdp-perks">
          <div className="pdp-perk">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
            Free delivery on orders over PKR 5,000
          </div>
          <div className="pdp-perk">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            Easy 14-day returns
          </div>
          <div className="pdp-perk">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            </svg>
            Customer support 7 days a week
          </div>
        </div>

        {/* Accordion */}
        <div className="pdp-accordion">
          <details open>
            <summary>Description</summary>
            <p>{p.description}</p>
          </details>
          <details>
            <summary>Size &amp; Fit</summary>
            <p>
              True to size for most. If you are between sizes, we recommend sizing up for a roomier fit.
            </p>
          </details>
          <details>
            <summary>Shipping &amp; Returns</summary>
            <p>
              Orders ship within 1-2 business days. Delivery takes 2-5 business days across Pakistan. Unworn items can be returned within 14 days of delivery.
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}
