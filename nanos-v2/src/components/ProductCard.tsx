"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
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
  const router = useRouter();
  const wishlist = useWishlist();
  const isItemWished = wishlist.isWished(id);
  const cart = useCart();

  function handleBuyNow(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const selectedColor = colors[0]?.name || "Standard";
    const selectedSize = sizes[0] || "Standard";

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

    router.push("/checkout");
  }

  return (
    <div className="product-card">
      <div className="product-thumb" style={{ position: "relative" }}>
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
          aria-label={isItemWished ? "Remove from wishlist" : "Add to wishlist"}
          className={`wish-btn ${isItemWished ? "active" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            wishlist.toggleWishlist({
              productId: id,
              name,
              price,
              oldPrice,
              img: hero,
              color: colors[0]?.name || "Standard",
              size: sizes[0] || "Standard",
              category,
            });
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
          {oldPrice && (
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

        {category === "trousers" ? (
          <button
            type="button"
            disabled
            className="quick-add coming-soon"
            style={{ marginTop: 12 }}
          >
            Coming Soon
          </button>
        ) : (
          <button
            type="button"
            onClick={handleBuyNow}
            className="card-buy-now"
            style={{
              width: "100%",
              minHeight: 44,
              marginTop: 12,
              padding: "10px 12px",
              fontSize: 13,
              fontWeight: 700,
              background: "var(--black, #111)",
              color: "var(--white, #fff)",
              border: "1.5px solid var(--black, #111)",
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease",
            }}
          >
            Buy Now
          </button>
        )}
      </div>
    </div>
  );
}
