"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
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

export interface BundlePricingInfo {
  buy1Price: number;
  buy2Price: number;
  buy2UnitPrice: number;
  buy2DiscountText: string;
  buy3Price: number;
  buy3UnitPrice: number;
  buy3DiscountText: string;
  enabled: boolean;
}

export function PdpActions({
  product: p,
  bundlePricing,
}: {
  product: ProductData;
  bundlePricing?: BundlePricingInfo;
}) {
  const [mounted, setMounted] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [color, setColor] = useState<string>(p.colors[0]?.name || "");
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const cart = useCart();
  const wishlist = useWishlist();
  const isItemWished = wishlist.isWished(p.id);

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

  const [bundleTier, setBundleTier] = useState<1 | 2 | 3>(1);

  const b1Price = bundlePricing?.buy1Price ?? p.price;
  const b2Price = bundlePricing?.buy2Price ?? Math.round(p.price * 2 * 0.9);
  const b2UnitPrice = bundlePricing?.buy2UnitPrice ?? Math.round(p.price * 0.9);
  const b2DiscountText = bundlePricing?.buy2DiscountText ?? "10% OFF";
  const b3Price = bundlePricing?.buy3Price ?? Math.round(p.price * 3 * 0.85);
  const b3UnitPrice = bundlePricing?.buy3UnitPrice ?? Math.round(p.price * 0.85);
  const b3DiscountText = bundlePricing?.buy3DiscountText ?? "15% OFF";
  const bundleEnabled = bundlePricing?.enabled !== false;

  const effectiveUnitPrice =
    bundleTier === 2
      ? b2UnitPrice
      : bundleTier === 3
      ? b3UnitPrice
      : b1Price;

  const effectiveQty = bundleTier;
  const effectiveTotal =
    bundleTier === 2 ? b2Price : bundleTier === 3 ? b3Price : b1Price;

  function handleAdd() {
    if (!size) return;
    const sizeStock = getStockForSize(size);
    if (sizeStock === 0) return;

    const bundleNameSuffix =
      bundleTier === 2
        ? ` · 2-Pack (${b2DiscountText})`
        : bundleTier === 3
        ? ` · 3-Pack (${b3DiscountText})`
        : "";

    cart.addItem(
      {
        productId: p.id,
        name: p.name + bundleNameSuffix,
        color,
        size,
        price: effectiveUnitPrice,
        img: displayedImage,
      },
      effectiveQty
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
        <div className="pdp-main-image" style={{ transition: "opacity 0.2s ease", position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={displayedImage} alt={p.name} />
          {p.category === "trousers" && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(17, 17, 17, 0.65)",
                backdropFilter: "blur(4px)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 4,
                pointerEvents: "none",
              }}
            >
              <span
                style={{
                  background: "var(--accent, #C8FF00)",
                  color: "#111",
                  fontFamily: "var(--font-head, sans-serif)",
                  fontSize: "12px",
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  padding: "8px 18px",
                  borderRadius: "24px",
                  textTransform: "uppercase",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.6)",
                }}
              >
                Coming Soon
              </span>
            </div>
          )}
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
          <h1 style={{ margin: 0 }}>{p.name}</h1>
          {p.category === "trousers" && (
            <span
              style={{
                background: "var(--accent, #C8FF00)",
                color: "#111",
                fontSize: "10px",
                fontWeight: 800,
                letterSpacing: "0.1em",
                padding: "3px 10px",
                borderRadius: "12px",
                textTransform: "uppercase",
              }}
            >
              Coming Soon
            </span>
          )}
        </div>
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
                    disabled={isOutOfStock || p.category === "trousers"}
                    aria-label={`Select size ${s}`}
                    className={`size-opt ${size === s ? "selected" : ""} ${isOutOfStock ? "out-of-stock" : ""}`}
                    style={{
                      opacity: isOutOfStock || p.category === "trousers" ? 0.35 : 1,
                      textDecoration: isOutOfStock ? "line-through" : "none",
                      cursor: isOutOfStock || p.category === "trousers" ? "not-allowed" : "pointer",
                      position: "relative",
                    }}
                    onClick={() => {
                      if (!isOutOfStock && p.category !== "trousers") setSize(s);
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
              disabled={p.category === "trousers"}
              aria-label="Decrease quantity"
              onClick={() => setQty(Math.max(1, qty - 1))}
            >
              −
            </button>
            <span className="qty-val">{qty}</span>
            <button
              type="button"
              disabled={p.category === "trousers"}
              aria-label="Increase quantity"
              onClick={() => setQty(qty + 1)}
            >
              +
            </button>
          </div>
        </div>

        {/* Choose your bundle */}
        {bundleEnabled && (
          <div style={{ margin: "24px 0 24px 0" }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                marginBottom: 12,
                letterSpacing: "-0.01em",
              }}
            >
              Choose your bundle
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* TIER 1: BUY 1 */}
              <div
                onClick={() => setBundleTier(1)}
                style={{
                  position: "relative",
                  padding: "14px 18px",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "all 0.18s ease",
                  border: bundleTier === 1 ? "2px solid var(--black, #111111)" : "1.5px solid var(--stone, #D9D6CF)",
                  background:
                    bundleTier === 1
                      ? "rgba(200, 255, 0, 0.14)"
                      : "var(--white, #FFFFFF)",
                  boxShadow: bundleTier === 1 ? "0 4px 14px rgba(0,0,0,0.06)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Custom Radio Circle */}
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      border: bundleTier === 1 ? "2px solid var(--black, #111111)" : "2px solid #BBB",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      background: "var(--white, #FFFFFF)",
                    }}
                  >
                    {bundleTier === 1 && (
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: "var(--black, #111111)",
                        }}
                      />
                    )}
                  </div>

                  {/* 1 Thumbnail */}
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 6,
                      overflow: "hidden",
                      background: "var(--off-white, #F7F5F0)",
                      border: "1px solid var(--stone, #D9D6CF)",
                      flexShrink: 0,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={displayedImage}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>

                  {/* Text info */}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--black, #111111)" }}>Buy 1</div>
                    <div style={{ fontSize: 12, color: "#666666", marginTop: 2 }}>
                      {fmtPrice(b1Price)} each · Pick your article and size
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em", color: "var(--black, #111111)" }}>
                    {fmtPrice(b1Price)}
                  </div>
                </div>
              </div>

              {/* TIER 2: BUY 2 */}
              <div
                onClick={() => setBundleTier(2)}
                style={{
                  position: "relative",
                  padding: "14px 18px",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "all 0.18s ease",
                  border: bundleTier === 2 ? "2px solid var(--black, #111111)" : "1.5px solid var(--stone, #D9D6CF)",
                  background:
                    bundleTier === 2
                      ? "rgba(200, 255, 0, 0.14)"
                      : "var(--white, #FFFFFF)",
                  boxShadow: bundleTier === 2 ? "0 4px 14px rgba(0,0,0,0.06)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                {/* Floating Badge: MOST POPULAR */}
                <div
                  style={{
                    position: "absolute",
                    top: -10,
                    right: 14,
                    background: "var(--lime, #C8FF00)",
                    color: "var(--black, #111111)",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    padding: "2px 10px",
                    borderRadius: 12,
                    textTransform: "uppercase",
                    border: "1px solid rgba(0,0,0,0.12)",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                  }}
                >
                  MOST POPULAR
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Custom Radio Circle */}
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      border: bundleTier === 2 ? "2px solid var(--black, #111111)" : "2px solid #BBB",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      background: "var(--white, #FFFFFF)",
                    }}
                  >
                    {bundleTier === 2 && (
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: "var(--black, #111111)",
                        }}
                      />
                    )}
                  </div>

                  {/* 2 Thumbnails */}
                  <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        overflow: "hidden",
                        background: "var(--off-white, #F7F5F0)",
                        border: "1px solid var(--stone, #D9D6CF)",
                        zIndex: 2,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={displayedImage}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        overflow: "hidden",
                        background: "var(--off-white, #F7F5F0)",
                        border: "1px solid var(--stone, #D9D6CF)",
                        marginLeft: -8,
                        zIndex: 1,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={gallery[1] || displayedImage}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                  </div>

                  {/* Text info */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--black, #111111)" }}>Buy 2</span>
                      <span
                        style={{
                          background: "rgba(200, 255, 0, 0.35)",
                          color: "var(--black, #111111)",
                          border: "1px solid rgba(160, 204, 0, 0.6)",
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 7px",
                          borderRadius: 10,
                          letterSpacing: "0.02em",
                        }}
                      >
                        {b2DiscountText}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#666666", marginTop: 2 }}>
                      {fmtPrice(b2UnitPrice)} each · Pick two articles and sizes
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em", color: "var(--black, #111111)" }}>
                    {fmtPrice(b2Price)}
                  </div>
                  {b2Price < b1Price * 2 && (
                    <div style={{ fontSize: 11, color: "#888888", textDecoration: "line-through" }}>
                      {fmtPrice(b1Price * 2)}
                    </div>
                  )}
                </div>
              </div>

              {/* TIER 3: BUY 3 */}
              <div
                onClick={() => setBundleTier(3)}
                style={{
                  position: "relative",
                  padding: "14px 18px",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "all 0.18s ease",
                  border: bundleTier === 3 ? "2px solid var(--black, #111111)" : "1.5px solid var(--stone, #D9D6CF)",
                  background:
                    bundleTier === 3
                      ? "rgba(200, 255, 0, 0.14)"
                      : "var(--white, #FFFFFF)",
                  boxShadow: bundleTier === 3 ? "0 4px 14px rgba(0,0,0,0.06)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                {/* Floating Badge: BEST VALUE */}
                <div
                  style={{
                    position: "absolute",
                    top: -10,
                    right: 14,
                    background: "var(--lime, #C8FF00)",
                    color: "var(--black, #111111)",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    padding: "2px 10px",
                    borderRadius: 12,
                    textTransform: "uppercase",
                    border: "1px solid rgba(0,0,0,0.12)",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                  }}
                >
                  BEST VALUE
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Custom Radio Circle */}
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      border: bundleTier === 3 ? "2px solid var(--black, #111111)" : "2px solid #BBB",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      background: "var(--white, #FFFFFF)",
                    }}
                  >
                    {bundleTier === 3 && (
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: "var(--black, #111111)",
                        }}
                      />
                    )}
                  </div>

                  {/* 3 Thumbnails */}
                  <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 5,
                        overflow: "hidden",
                        background: "var(--off-white, #F7F5F0)",
                        border: "1px solid var(--stone, #D9D6CF)",
                        zIndex: 3,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={displayedImage}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 5,
                        overflow: "hidden",
                        background: "var(--off-white, #F7F5F0)",
                        border: "1px solid var(--stone, #D9D6CF)",
                        marginLeft: -8,
                        zIndex: 2,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={gallery[1] || displayedImage}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 5,
                        overflow: "hidden",
                        background: "var(--off-white, #F7F5F0)",
                        border: "1px solid var(--stone, #D9D6CF)",
                        marginLeft: -8,
                        zIndex: 1,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={gallery[2] || gallery[0] || displayedImage}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                  </div>

                  {/* Text info */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--black, #111111)" }}>Buy 3</span>
                      <span
                        style={{
                          background: "rgba(200, 255, 0, 0.35)",
                          color: "var(--black, #111111)",
                          border: "1px solid rgba(160, 204, 0, 0.6)",
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 7px",
                          borderRadius: 10,
                          letterSpacing: "0.02em",
                        }}
                      >
                        {b3DiscountText}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#666666", marginTop: 2 }}>
                      {fmtPrice(b3UnitPrice)} each · Pick three articles and sizes
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em", color: "var(--black, #111111)" }}>
                    {fmtPrice(b3Price)}
                  </div>
                  {b3Price < b1Price * 3 && (
                    <div style={{ fontSize: 11, color: "#888888", textDecoration: "line-through" }}>
                      {fmtPrice(b1Price * 3)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PDP Actions */}
        <div className="pdp-actions">
          {p.category === "trousers" ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled
              style={{ opacity: 0.6, cursor: "not-allowed", background: "var(--surface-2, #2a2a2a)" }}
            >
              Coming Soon
            </button>
          ) : (
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
                : `Add to Cart — ${fmtPrice(effectiveTotal)}`}
            </button>
          )}
          <button
            type="button"
            className={`wish-toggle ${isItemWished ? "active" : ""}`}
            onClick={() =>
              wishlist.toggleWishlist({
                productId: p.id,
                name: p.name,
                price: p.price,
                oldPrice: p.oldPrice,
                img: displayedImage,
                color,
                size: size || p.sizes[0] || "Standard",
                category: p.category,
              })
            }
            aria-label={isItemWished ? "Remove from wishlist" : "Add to wishlist"}
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
