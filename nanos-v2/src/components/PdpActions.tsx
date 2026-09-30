"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  ignoreStock?: boolean;
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

interface BundlePairSelection {
  color: string;
  size: string | null;
}

export function PdpActions({
  product: p,
  bundlePricing,
}: {
  product: ProductData;
  bundlePricing?: BundlePricingInfo;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [color, setColor] = useState<string>(p.colors[0]?.name || "Standard");
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  // Independent configuration per pair for bundle tiers (up to 3 pairs)
  const [bundlePairs, setBundlePairs] = useState<BundlePairSelection[]>([
    { color: p.colors[0]?.name || "Standard", size: null },
    { color: p.colors[0]?.name || "Standard", size: null },
    { color: p.colors[0]?.name || "Standard", size: null },
  ]);

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
    if (p.ignoreStock) {
      return 999;
    }
    if (p.stockLevels && p.stockLevels.length > 0) {
      return stockForSelectedColor[sz] ?? 0;
    }
    return 999;
  }

  function getStockForColorAndSize(colorName: string, sz: string): number {
    if (p.ignoreStock) {
      return 999;
    }
    if (p.stockLevels && p.stockLevels.length > 0) {
      const found = p.stockLevels.find(
        (s) =>
          s.color.toLowerCase() === colorName.toLowerCase() &&
          s.size.toLowerCase() === sz.toLowerCase()
      );
      return found ? found.quantity : 0;
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

  const effectiveTotal =
    bundleTier === 2 ? b2Price : bundleTier === 3 ? b3Price : b1Price * qty;

  function handleColorSelect(c: ProductColor) {
    setColor(c.name);
    setImgIdx(0);
    setActiveImage(null);

    if (size && getStockForColorAndSize(c.name, size) === 0) {
      setSize(null);
    }
  }

  function handleAdd() {
    if (!isAllBundleSizesSelected || p.category === "trousers") return;

    if (bundleTier === 1) {
      if (!size) return;
      cart.addItem(
        {
          productId: p.id,
          name: p.name,
          color,
          size,
          price: b1Price,
          img: displayedImage,
        },
        qty
      );
    } else {
      // Add each pair as its own line item with bundle unit price
      for (let i = 0; i < bundleTier; i++) {
        const pair = bundlePairs[i];
        const pairColorObj = p.productColors?.find(
          (c) => c.name.toLowerCase() === pair.color.toLowerCase()
        );
        let pairImg = displayedImage;
        if (pairColorObj) {
          try {
            const parsed = JSON.parse(pairColorObj.imagesJson || "[]");
            if (parsed[0]) pairImg = parsed[0];
          } catch {}
        }

        const tierLabel = bundleTier === 2 ? b2DiscountText : b3DiscountText;
        cart.addItem(
          {
            productId: p.id,
            name: `${p.name} (Pair #${i + 1} of ${bundleTier} · ${tierLabel})`,
            color: pair.color,
            size: pair.size!,
            price: effectiveUnitPrice,
            img: pairImg,
          },
          1
        );
      }
    }

    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  function handleBuyNow(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isAllBundleSizesSelected || p.category === "trousers") return;

    if (bundleTier === 1) {
      if (!size) return;
      cart.addItem(
        {
          productId: p.id,
          name: p.name,
          color,
          size,
          price: b1Price,
          img: displayedImage,
        },
        qty
      );
    } else {
      for (let i = 0; i < bundleTier; i++) {
        const pair = bundlePairs[i];
        const pairColorObj = p.productColors?.find(
          (c) => c.name.toLowerCase() === pair.color.toLowerCase()
        );
        let pairImg = displayedImage;
        if (pairColorObj) {
          try {
            const parsed = JSON.parse(pairColorObj.imagesJson || "[]");
            if (parsed[0]) pairImg = parsed[0];
          } catch {}
        }

        const tierLabel = bundleTier === 2 ? b2DiscountText : b3DiscountText;
        cart.addItem(
          {
            productId: p.id,
            name: `${p.name} (Pair #${i + 1} of ${bundleTier} · ${tierLabel})`,
            color: pair.color,
            size: pair.size!,
            price: effectiveUnitPrice,
            img: pairImg,
          },
          1
        );
      }
    }

    router.push("/checkout");
  }

  function handlePairColorSelect(pairIndex: number, newColorName: string) {
    setBundlePairs((prev) => {
      const next = [...prev];
      const currentSize = next[pairIndex]?.size;
      const stock = currentSize ? getStockForColorAndSize(newColorName, currentSize) : 0;
      next[pairIndex] = {
        color: newColorName,
        size: stock > 0 ? currentSize : null,
      };
      return next;
    });

    const pairColorObj = p.productColors?.find(
      (c) => c.name.toLowerCase() === newColorName.toLowerCase()
    );
    if (pairColorObj) {
      try {
        const parsed = JSON.parse(pairColorObj.imagesJson || "[]");
        if (parsed[0]) {
          setActiveImage(parsed[0]);
        }
      } catch {}
    }
  }

  function handlePairSizeSelect(pairIndex: number, newSize: string) {
    setBundlePairs((prev) => {
      const next = [...prev];
      next[pairIndex] = {
        ...next[pairIndex],
        size: newSize,
      };
      return next;
    });
  }

  const missingPairIndex =
    bundleTier === 1
      ? (!size ? 0 : -1)
      : bundlePairs
          .slice(0, bundleTier)
          .findIndex((pair) => !pair.size || getStockForColorAndSize(pair.color, pair.size) === 0);

  const isAllBundleSizesSelected = missingPairIndex === -1;

  const buttonText = (() => {
    if (added) return "Added ✓";
    if (p.category === "trousers") return "Coming Soon";
    if (bundleTier === 1) {
      if (!size) return "Select a size";
      return `Add to Cart — ${fmtPrice(effectiveTotal)}`;
    }
    if (missingPairIndex !== -1) {
      return `Select size for Pair ${missingPairIndex + 1}`;
    }
    return `Add to Cart — ${fmtPrice(effectiveTotal)}`;
  })();

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
          <span className="price">{fmtPrice(effectiveTotal)}</span>
          {p.oldPrice && bundleTier === 1 && (
            <>
              <span className="price-old">{fmtPrice(p.oldPrice)}</span>
              <span className="badge badge-sale">SALE</span>
            </>
          )}
          {bundleTier > 1 && (
            <span
              style={{
                fontSize: "13px",
                color: "#666",
                fontWeight: 500,
              }}
            >
              ({fmtPrice(effectiveUnitPrice)} / pair)
            </span>
          )}
        </div>

        <div className="pdp-rating">
          <span>★ {p.rating}</span>
          <span>({p.reviews} reviews)</span>
        </div>

        {/* SINGLE PAIR SELECTOR (TIER 1) - Color, Size, Quantity directly under Reviews */}
        {bundleTier === 1 && (
          <div style={{ marginTop: 16 }}>
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
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity Row */}
            <div className="qty-row" style={{ marginBottom: 18 }}>
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
          </div>
        )}

        {/* Choose your bundle / Buy Pair Offer - Positioned under Color, Size, and Quantity */}
        {bundleEnabled && (
          <div style={{ margin: bundleTier === 1 ? "14px 0 24px 0" : "18px 0 20px 0" }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 10,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                color: "#222",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>Bundle &amp; Save Offer</span>
            </div>

            <div className="bundle-list">
              {/* TIER 1: BUY 1 */}
              <div
                onClick={() => setBundleTier(1)}
                className="bundle-card"
                style={{
                  border: bundleTier === 1 ? "2px solid var(--black, #111111)" : "1.5px solid var(--stone, #D9D6CF)",
                  background:
                    bundleTier === 1
                      ? "rgba(200, 255, 0, 0.14)"
                      : "var(--white, #FFFFFF)",
                  boxShadow: bundleTier === 1 ? "0 4px 14px rgba(0,0,0,0.06)" : "none",
                }}
              >
                <div className="bundle-card-left">
                  <div
                    className="bundle-radio-circle"
                    style={{
                      border: bundleTier === 1 ? "2px solid var(--black, #111111)" : "2px solid #BBB",
                    }}
                  >
                    {bundleTier === 1 && <div className="bundle-radio-dot" />}
                  </div>

                  <div className="bundle-card-text">
                    <div className="bundle-card-name">Buy 1</div>
                    <div className="bundle-card-desc">
                      {fmtPrice(b1Price)} each · 1 Pair
                    </div>
                  </div>
                </div>

                <div className="bundle-card-right">
                  <div className="bundle-card-price">
                    {fmtPrice(b1Price)}
                  </div>
                </div>
              </div>

              {/* TIER 2: BUY 2 */}
              <div
                onClick={() => {
                  setBundleTier(2);
                  setBundlePairs((prev) => {
                    const next = [...prev];
                    next[0] = {
                      color: color,
                      size: size && getStockForColorAndSize(color, size) > 0 ? size : next[0]?.size || null,
                    };
                    return next;
                  });
                }}
                className="bundle-card"
                style={{
                  border: bundleTier === 2 ? "2px solid var(--black, #111111)" : "1.5px solid var(--stone, #D9D6CF)",
                  background:
                    bundleTier === 2
                      ? "rgba(200, 255, 0, 0.14)"
                      : "var(--white, #FFFFFF)",
                  boxShadow: bundleTier === 2 ? "0 4px 14px rgba(0,0,0,0.06)" : "none",
                }}
              >
                <div className="bundle-pill-badge">
                  MOST POPULAR
                </div>

                <div className="bundle-card-left">
                  <div
                    className="bundle-radio-circle"
                    style={{
                      border: bundleTier === 2 ? "2px solid var(--black, #111111)" : "2px solid #BBB",
                    }}
                  >
                    {bundleTier === 2 && <div className="bundle-radio-dot" />}
                  </div>

                  <div className="bundle-card-text">
                    <div className="bundle-card-header">
                      <span className="bundle-card-name">Buy 2 (Pair)</span>
                      <span className="bundle-card-badge-inline">
                        {b2DiscountText}
                      </span>
                    </div>
                    <div className="bundle-card-desc">
                      {fmtPrice(b2UnitPrice)} each · Mix &amp; match colors &amp; sizes
                    </div>
                  </div>
                </div>

                <div className="bundle-card-right">
                  <div className="bundle-card-price">
                    {fmtPrice(b2Price)}
                  </div>
                  {b2Price < b1Price * 2 && (
                    <div className="bundle-card-old-price">
                      {fmtPrice(b1Price * 2)}
                    </div>
                  )}
                </div>
              </div>

              {/* TIER 3: BUY 3 */}
              <div
                onClick={() => {
                  setBundleTier(3);
                  setBundlePairs((prev) => {
                    const next = [...prev];
                    next[0] = {
                      color: color,
                      size: size && getStockForColorAndSize(color, size) > 0 ? size : next[0]?.size || null,
                    };
                    return next;
                  });
                }}
                className="bundle-card"
                style={{
                  border: bundleTier === 3 ? "2px solid var(--black, #111111)" : "1.5px solid var(--stone, #D9D6CF)",
                  background:
                    bundleTier === 3
                      ? "rgba(200, 255, 0, 0.14)"
                      : "var(--white, #FFFFFF)",
                  boxShadow: bundleTier === 3 ? "0 4px 14px rgba(0,0,0,0.06)" : "none",
                }}
              >
                <div className="bundle-pill-badge">
                  BEST VALUE
                </div>

                <div className="bundle-card-left">
                  <div
                    className="bundle-radio-circle"
                    style={{
                      border: bundleTier === 3 ? "2px solid var(--black, #111111)" : "2px solid #BBB",
                    }}
                  >
                    {bundleTier === 3 && <div className="bundle-radio-dot" />}
                  </div>

                  <div className="bundle-card-text">
                    <div className="bundle-card-header">
                      <span className="bundle-card-name">Buy 3</span>
                      <span className="bundle-card-badge-inline">
                        {b3DiscountText}
                      </span>
                    </div>
                    <div className="bundle-card-desc">
                      {fmtPrice(b3UnitPrice)} each · Mix &amp; match colors &amp; sizes
                    </div>
                  </div>
                </div>

                <div className="bundle-card-right">
                  <div className="bundle-card-price">
                    {fmtPrice(b3Price)}
                  </div>
                  {b3Price < b1Price * 3 && (
                    <div className="bundle-card-old-price">
                      {fmtPrice(b1Price * 3)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MULTI-PAIR BUNDLE SELECTOR (TIER 2 & TIER 3) */}
        {bundleTier > 1 && (
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em" }}>
                Choose Your Pairs ({bundleTier} Pairs)
              </span>
              <span style={{ fontSize: 11.5, color: "#666" }}>
                Mix &amp; match colors &amp; sizes
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {Array.from({ length: bundleTier }).map((_, idx) => {
                const pair = bundlePairs[idx] || { color: p.colors[0]?.name || "Standard", size: null };
                const pairColorObj = p.colors.find((c) => c.name.toLowerCase() === pair.color.toLowerCase()) || p.colors[0];

                return (
                  <div
                    key={`pair-card-${idx}`}
                    style={{
                      border: "1.5px solid var(--stone, #D9D6CF)",
                      borderRadius: 8,
                      padding: "12px 14px",
                      background: "var(--white, #FFFFFF)",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                    }}
                  >
                    {/* Header: Pair Number & Color Tag */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 10,
                        paddingBottom: 8,
                        borderBottom: "1px solid #ECEAE5",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            background: "var(--black, #111111)",
                            color: "var(--white, #FFFFFF)",
                            fontSize: 10.5,
                            fontWeight: 800,
                            padding: "2px 8px",
                            borderRadius: 4,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                          }}
                        >
                          Pair {idx + 1}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#222" }}>
                          {pair.color}
                        </span>
                      </div>

                      <div style={{ fontSize: 12, color: pair.size ? "var(--black, #111111)" : "#888", fontWeight: 600 }}>
                        {pair.size ? `Size: ${pair.size}` : "Size not selected"}
                      </div>
                    </div>

                    {/* Color Swatches for this pair */}
                    {p.colors.length > 1 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11.5, color: "#666", marginBottom: 6, fontWeight: 500 }}>
                          Select Color:
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {p.colors.map((c) => (
                            <button
                              key={`pair-${idx}-color-${c.name}`}
                              type="button"
                              title={c.name}
                              aria-label={`Select ${c.name} for pair ${idx + 1}`}
                              onClick={() => handlePairColorSelect(idx, c.name)}
                              style={{
                                width: 34,
                                height: 34,
                                minWidth: 34,
                                minHeight: 34,
                                borderRadius: "50%",
                                border: pair.color === c.name ? "2px solid var(--black, #111)" : "1.5px solid transparent",
                                padding: 2,
                                cursor: "pointer",
                                background: "none",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <span
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  borderRadius: "50%",
                                  background: c.hex,
                                  border: "1px solid rgba(0,0,0,0.15)",
                                  display: "block",
                                }}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Size Selector for this pair */}
                    <div>
                      <div style={{ fontSize: 11.5, color: "#666", marginBottom: 6, fontWeight: 500 }}>
                        Select Size:
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {p.sizes.map((s) => {
                          const stk = getStockForColorAndSize(pair.color, s);
                          const isOutOfStock = stk === 0;
                          const isSelected = pair.size === s;

                          return (
                            <button
                              key={`pair-${idx}-size-${s}`}
                              type="button"
                              disabled={isOutOfStock || p.category === "trousers"}
                              aria-label={`Select size ${s} for pair ${idx + 1}`}
                              onClick={() => {
                                if (!isOutOfStock && p.category !== "trousers") {
                                  handlePairSizeSelect(idx, s);
                                }
                              }}
                              style={{
                                minWidth: 44,
                                minHeight: 40,
                                height: 40,
                                padding: "0 12px",
                                borderRadius: 4,
                                fontSize: 13,
                                fontWeight: isSelected ? 700 : 500,
                                border: isSelected ? "2px solid var(--black, #111)" : "1.5px solid var(--stone, #D9D6CF)",
                                background: isSelected ? "var(--black, #111)" : "var(--white, #FFF)",
                                color: isSelected ? "#FFFFFF" : isOutOfStock ? "#AAA" : "#111111",
                                WebkitTextFillColor: isSelected ? "#FFFFFF" : isOutOfStock ? "#AAA" : "#111111",
                                textDecoration: isOutOfStock ? "line-through" : "none",
                                opacity: isOutOfStock || p.category === "trousers" ? 0.35 : 1,
                                cursor: isOutOfStock || p.category === "trousers" ? "not-allowed" : "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PDP Actions (Add to Cart & Buy Now) */}
        <div className="pdp-actions-container">
          {p.category === "trousers" ? (
            <button
              type="button"
              className="pdp-btn-main"
              disabled
              style={{ opacity: 0.6, cursor: "not-allowed", background: "var(--surface-2, #2a2a2a)", width: "100%" }}
            >
              Coming Soon
            </button>
          ) : (
            <>
              <div className="pdp-actions-row">
                <button
                  type="button"
                  className="pdp-btn-main"
                  disabled={!isAllBundleSizesSelected}
                  onClick={handleAdd}
                >
                  {buttonText}
                </button>
                <button
                  type="button"
                  className={`pdp-wish-btn ${isItemWished ? "active" : ""}`}
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

              <button
                type="button"
                className="pdp-btn-buynow"
                disabled={!isAllBundleSizesSelected}
                onClick={handleBuyNow}
              >
                Buy Now
              </button>
            </>
          )}
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
