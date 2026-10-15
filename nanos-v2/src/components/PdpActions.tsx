"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { fmtPrice } from "@/lib/cart";
import { trackMeta } from "@/lib/fpixel";
import { trackTikTok } from "@/lib/tiktok-pixel";
import type { Product, ProductColor } from "@/lib/types";

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

export interface BundlePairSelection {
  productId: string;
  name: string;
  color: string;
  size: string | null;
  price: number;
  hero: string;
  availableSizes: string[];
}

export function PdpActions({
  product: p,
  bundlePricing,
  allProducts = [],
}: {
  product: ProductData;
  bundlePricing?: BundlePricingInfo;
  allProducts?: Product[];
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [color, setColor] = useState<string>(p.colors[0]?.name || "Standard");
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const trackedProductIdRef = useRef<string | null>(null);

  const [isPairsModalOpen, setIsPairsModalOpen] = useState(false);

  const createInitialPair = useCallback(
    (): BundlePairSelection => ({
      productId: p.id,
      name: p.name,
      color: p.colors[0]?.name || "Standard",
      size: null,
      price: p.price,
      hero: p.hero || "",
      availableSizes: p.sizes || [],
    }),
    [p.id, p.name, p.colors, p.price, p.hero, p.sizes]
  );

  // Independent configuration per pair for bundle tiers (up to 3 pairs)
  const [bundlePairs, setBundlePairs] = useState<BundlePairSelection[]>([
    createInitialPair(),
    createInitialPair(),
    createInitialPair(),
  ]);

  const cart = useCart();
  const wishlist = useWishlist();
  const isItemWished = wishlist.isWished(p.id);

  useEffect(() => {
    setMounted(true);
    if (trackedProductIdRef.current === p.id) return;
    trackedProductIdRef.current = p.id;

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

    trackTikTok(
      "ViewContent",
      {
        contents: [
          {
            content_id: p.id,
            content_type: "product",
            content_name: p.name,
          },
        ],
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

  // Fallback fetching of articles if allProducts not passed
  const [fetchedArticles, setFetchedArticles] = useState<Product[]>([]);

  useEffect(() => {
    if ((!allProducts || allProducts.length === 0) && p.category === "crocs") {
      fetch("/api/products?category=crocs")
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setFetchedArticles(data);
          }
        })
        .catch(() => {});
    }
  }, [allProducts, p.category]);

  const articles = useMemo(() => {
    const source = allProducts && allProducts.length > 0 ? allProducts : fetchedArticles;
    const list = source.length > 0 ? source : [p as any];
    const filtered =
      p.category === "crocs" ? list.filter((item) => item.category === "crocs") : list;
    const others = filtered.filter((item) => item.id !== p.id);
    return [p as any, ...others];
  }, [allProducts, fetchedArticles, p]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isPairsModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isPairsModalOpen]);

  const b1Price = bundlePricing?.buy1Price ?? p.price;
  const b2UnitPrice = bundlePricing?.buy2UnitPrice ?? Math.round(p.price * 0.9);
  const b2DiscountText = bundlePricing?.buy2DiscountText ?? "10% OFF";
  const b3UnitPrice = bundlePricing?.buy3UnitPrice ?? Math.round(p.price * 0.85);
  const b3DiscountText = bundlePricing?.buy3DiscountText ?? "15% OFF";
  const bundleEnabled = bundlePricing?.enabled !== false;

  const effectiveUnitPrice =
    bundleTier === 2 ? b2UnitPrice : bundleTier === 3 ? b3UnitPrice : b1Price;

  const activePairs = bundlePairs.slice(0, bundleTier);
  const bundleOriginalTotal = activePairs.reduce((sum, pair) => sum + pair.price, 0);

  const discountPercent =
    bundleTier === 2
      ? (bundlePricing?.buy2DiscountText?.includes("%")
          ? parseInt(bundlePricing.buy2DiscountText) || 10
          : 10)
      : bundleTier === 3
      ? (bundlePricing?.buy3DiscountText?.includes("%")
          ? parseInt(bundlePricing.buy3DiscountText) || 15
          : 15)
      : 0;

  const bundleDiscountedTotal =
    bundleTier > 1
      ? Math.round(bundleOriginalTotal * (1 - discountPercent / 100))
      : b1Price * qty;

  const bundleSavings = Math.max(0, bundleOriginalTotal - bundleDiscountedTotal);

  const getPairEffectivePrice = (pairIdx: number): number => {
    if (bundleTier === 1) return b1Price;
    if (pairIdx === bundleTier - 1) {
      const previousTotal = activePairs
        .slice(0, pairIdx)
        .reduce((sum, pr) => sum + Math.round(pr.price * (1 - discountPercent / 100)), 0);
      return Math.max(0, bundleDiscountedTotal - previousTotal);
    }
    return Math.round(activePairs[pairIdx].price * (1 - discountPercent / 100));
  };

  const effectiveTotal = bundleDiscountedTotal;

  function handleColorSelect(c: ProductColor) {
    setColor(c.name);
    setImgIdx(0);
    setActiveImage(null);

    if (size && getStockForColorAndSize(c.name, size) === 0) {
      setSize(null);
    }
  }

  function handlePairArticleSelect(pairIdx: number, article: Product | ProductData) {
    setBundlePairs((prev) => {
      const next = [...prev];
      const cur = next[pairIdx];
      const newSizes = article.sizes || [];
      const keepSize = cur.size && newSizes.includes(cur.size) ? cur.size : null;
      next[pairIdx] = {
        productId: article.id,
        name: article.name,
        color: article.colors[0]?.name || "Standard",
        size: keepSize,
        price: article.price,
        hero: article.hero || "",
        availableSizes: newSizes,
      };
      return next;
    });
  }

  function handlePairSizeSelect(pairIdx: number, newSize: string) {
    setBundlePairs((prev) => {
      const next = [...prev];
      next[pairIdx] = {
        ...next[pairIdx],
        size: newSize,
      };
      return next;
    });
  }

  const missingPairIndex =
    bundleTier === 1
      ? (!size ? 0 : -1)
      : activePairs.findIndex((pair) => !pair.size);

  const isAllBundleSizesSelected = missingPairIndex === -1;

  function handleAdd() {
    if (p.category === "trousers") return;

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
      if (!isAllBundleSizesSelected) {
        setIsPairsModalOpen(true);
        return;
      }

      for (let i = 0; i < bundleTier; i++) {
        const pair = activePairs[i];
        const tierLabel = bundleTier === 2 ? b2DiscountText : b3DiscountText;
        const pairPrice = getPairEffectivePrice(i);

        cart.addItem(
          {
            productId: pair.productId,
            name: `${pair.name} (Pair #${i + 1} of ${bundleTier} · ${tierLabel})`,
            color: pair.color,
            size: pair.size!,
            price: pairPrice,
            img: pair.hero || displayedImage,
          },
          1
        );
      }
    }

    setIsPairsModalOpen(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
    router.push("/cart");
  }

  function handleBuyNow(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (p.category === "trousers") return;

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
      if (!isAllBundleSizesSelected) {
        setIsPairsModalOpen(true);
        return;
      }

      for (let i = 0; i < bundleTier; i++) {
        const pair = activePairs[i];
        const tierLabel = bundleTier === 2 ? b2DiscountText : b3DiscountText;
        const pairPrice = getPairEffectivePrice(i);

        cart.addItem(
          {
            productId: pair.productId,
            name: `${pair.name} (Pair #${i + 1} of ${bundleTier} · ${tierLabel})`,
            color: pair.color,
            size: pair.size!,
            price: pairPrice,
            img: pair.hero || displayedImage,
          },
          1
        );
      }
    }

    setIsPairsModalOpen(false);
    router.push("/checkout");
  }

  const buttonText = (() => {
    if (added) return "Added ✓";
    if (p.category === "trousers") return "Coming Soon";
    if (bundleTier === 1) {
      if (!size) return "Select a size";
      return `Add to Cart — ${fmtPrice(effectiveTotal)}`;
    }
    if (missingPairIndex !== -1) {
      return `Choose your pairs (${bundleTier} Pairs)`;
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
                  setIsPairsModalOpen(true);
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
                      {fmtPrice(b2UnitPrice)} each · Mix &amp; match articles &amp; sizes
                    </div>
                  </div>
                </div>

                <div className="bundle-card-right">
                  <div className="bundle-card-price">
                    {fmtPrice(Math.round(p.price * 2 * (1 - discountPercent / 100)))}
                  </div>
                  <div className="bundle-card-old-price">
                    {fmtPrice(p.price * 2)}
                  </div>
                </div>
              </div>

              {/* TIER 3: BUY 3 */}
              <div
                onClick={() => {
                  setBundleTier(3);
                  setIsPairsModalOpen(true);
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
                      {fmtPrice(b3UnitPrice)} each · Mix &amp; match articles &amp; sizes
                    </div>
                  </div>
                </div>

                <div className="bundle-card-right">
                  <div className="bundle-card-price">
                    {fmtPrice(Math.round(p.price * 3 * (1 - 15 / 100)))}
                  </div>
                  <div className="bundle-card-old-price">
                    {fmtPrice(p.price * 3)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MULTI-PAIR BUNDLE SELECTOR & SUMMARY (TIER 2 & TIER 3) */}
        {bundleTier > 1 && (
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.02em",
                  }}
                >
                  Selected Pairs ({bundleTier} Pairs)
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    backgroundColor: "#166534",
                    color: "#FFFFFF",
                    padding: "2px 8px",
                    borderRadius: 4,
                  }}
                >
                  Save {discountPercent}%
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPairsModalOpen(true)}
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "#111111",
                  background: "#F5F3EF",
                  border: "1px solid #D9D6CF",
                  borderRadius: 6,
                  padding: "5px 12px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>Choose / Change Pairs</span>
                <span>✏️</span>
              </button>
            </div>

            {/* Selected pairs summary cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {activePairs.map((pair, idx) => (
                <div
                  key={`pdp-pair-${idx}-${pair.productId}`}
                  onClick={() => setIsPairsModalOpen(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: pair.size ? "1.5px solid #D9D6CF" : "2px dashed #D97706",
                    background: pair.size ? "#FFFFFF" : "#FFFBEB",
                    cursor: "pointer",
                    gap: 12,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <span
                      style={{
                        background: "#111111",
                        color: "#FFFFFF",
                        fontSize: 10.5,
                        fontWeight: 800,
                        padding: "3px 8px",
                        borderRadius: 4,
                        letterSpacing: "0.05em",
                        flexShrink: 0,
                      }}
                    >
                      PAIR {idx + 1}
                    </span>
                    {pair.hero ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={pair.hero}
                        alt={pair.name}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 6,
                          objectFit: "cover",
                          flexShrink: 0,
                          border: "1px solid #E5E5E5",
                        }}
                      />
                    ) : null}
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#111",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {pair.name}
                      </div>
                      <div style={{ fontSize: 11.5, color: "#666" }}>
                        {pair.color} · {pair.size ? `Size: ${pair.size}` : "⚠️ Size not selected (Click to choose)"}
                      </div>
                    </div>
                  </div>

                  <span style={{ fontSize: 12, color: "#888", fontWeight: 600, flexShrink: 0 }}>
                    Change →
                  </span>
                </div>
              ))}
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

      {/* CHOOSE YOUR PAIRS MODAL */}
      {isPairsModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="choose-pairs-title"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsPairsModalOpen(false);
            }
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              maxWidth: "640px",
              width: "100%",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.35)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "20px 24px",
                borderBottom: "1px solid #ECEAE5",
              }}
            >
              <div>
                <h2
                  id="choose-pairs-title"
                  style={{
                    margin: 0,
                    fontSize: "22px",
                    fontWeight: 800,
                    color: "#1F1E1D",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Choose your pairs
                </h2>
                <div style={{ fontSize: "12px", color: "#666", marginTop: 2 }}>
                  Mix &amp; match any article and size for all {bundleTier} pairs
                </div>
              </div>

              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setIsPairsModalOpen(false)}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  backgroundColor: "#F3F2EE",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#333",
                  transition: "background-color 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#E5E3DD")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F3F2EE")}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="1" y1="1" x2="13" y2="13" />
                  <line x1="13" y1="1" x2="1" y2="13" />
                </svg>
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "22px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 24,
              }}
            >
              {activePairs.map((pair, pairIdx) => (
                <div key={`modal-pair-${pairIdx}`}>
                  {/* Pair Title */}
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: 800,
                      color: "#1F1E1D",
                      marginBottom: 8,
                    }}
                  >
                    Pair {pairIdx + 1}
                  </div>

                  {/* ARTICLE Label */}
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#777777",
                      marginBottom: 10,
                    }}
                  >
                    ARTICLE
                  </div>

                  {/* Article Horizontal Scroll Carousel */}
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      overflowX: "auto",
                      paddingBottom: 8,
                      scrollbarWidth: "thin",
                      WebkitOverflowScrolling: "touch",
                    }}
                  >
                    {articles.map((art) => {
                      const isSelected = pair.productId === art.id;
                      return (
                        <div
                          key={`pair-${pairIdx}-art-${art.id}`}
                          onClick={() => handlePairArticleSelect(pairIdx, art)}
                          style={{
                            width: "125px",
                            minWidth: "125px",
                            borderRadius: "10px",
                            border: isSelected
                              ? "2px solid #8D7B68"
                              : "1.5px solid #E5E5E5",
                            background: isSelected ? "#FAF8F5" : "#FFFFFF",
                            padding: "6px",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            boxShadow: isSelected ? "0 2px 8px rgba(141, 123, 104, 0.18)" : "none",
                          }}
                        >
                          <div
                            style={{
                              width: "100%",
                              aspectRatio: "1 / 1",
                              borderRadius: "7px",
                              overflow: "hidden",
                              backgroundColor: "#F0EFEA",
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={art.hero || "/placeholder.jpg"}
                              alt={art.name}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: "block",
                              }}
                            />
                          </div>

                          <div
                            title={art.name}
                            style={{
                              fontSize: "11.5px",
                              fontWeight: 600,
                              color: "#1F1E1D",
                              marginTop: 6,
                              lineHeight: "1.3",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              height: "30px",
                            }}
                          >
                            {art.name}
                          </div>

                          <div
                            style={{
                              fontSize: "11px",
                              color: "#666",
                              marginTop: 2,
                              fontWeight: 600,
                            }}
                          >
                            {fmtPrice(art.price)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* SIZE Label */}
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#777777",
                      marginTop: 16,
                      marginBottom: 10,
                    }}
                  >
                    SIZE
                  </div>

                  {/* Sizes Row */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {(pair.availableSizes.length > 0 ? pair.availableSizes : p.sizes).map((sz) => {
                      const isSelected = pair.size === sz;
                      return (
                        <button
                          key={`pair-${pairIdx}-size-${sz}`}
                          type="button"
                          onClick={() => handlePairSizeSelect(pairIdx, sz)}
                          style={{
                            borderRadius: "9999px",
                            padding: "8px 20px",
                            fontSize: "13.5px",
                            fontWeight: isSelected ? 800 : 600,
                            border: isSelected ? "1.5px solid #8D7B68" : "1.5px solid #D9D6CF",
                            backgroundColor: isSelected ? "#FAF8F5" : "#FFFFFF",
                            color: isSelected ? "#8D7B68" : "#111111",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {sz}
                        </button>
                      );
                    })}
                  </div>

                  {/* Divider line between pairs */}
                  {pairIdx < bundleTier - 1 && (
                    <hr
                      style={{
                        border: "none",
                        borderTop: "1px solid #ECEAE5",
                        margin: "24px 0 0 0",
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Modal Bottom Sticky Bar */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #ECEAE5",
                backgroundColor: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: "0 -4px 16px rgba(0,0,0,0.04)",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontSize: "11.5px", color: "#666", marginBottom: 2 }}>
                  Total
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: "21px", fontWeight: 800, color: "#111111" }}>
                    {fmtPrice(bundleDiscountedTotal)}
                  </span>
                  {bundleSavings > 0 && (
                    <span
                      style={{
                        fontSize: "14px",
                        color: "#888888",
                        textDecoration: "line-through",
                        fontWeight: 500,
                      }}
                    >
                      {fmtPrice(bundleOriginalTotal)}
                    </span>
                  )}
                </div>
                {bundleSavings > 0 && (
                  <div
                    style={{
                      fontSize: "12.5px",
                      color: "#166534",
                      fontWeight: 700,
                      marginTop: 2,
                    }}
                  >
                    You save {fmtPrice(bundleSavings)} ({discountPercent}% off)
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={!isAllBundleSizesSelected}
                onClick={handleAdd}
                style={{
                  backgroundColor: isAllBundleSizesSelected ? "#B8A898" : "#D4CCC5",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "10px",
                  padding: "13px 32px",
                  fontSize: "13.5px",
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  cursor: isAllBundleSizesSelected ? "pointer" : "not-allowed",
                  transition: "background-color 0.15s ease",
                  boxShadow: isAllBundleSizesSelected
                    ? "0 4px 12px rgba(184, 168, 152, 0.4)"
                    : "none",
                }}
              >
                {isAllBundleSizesSelected
                  ? "ADD TO CART"
                  : `Select Size for Pair ${missingPairIndex + 1}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
