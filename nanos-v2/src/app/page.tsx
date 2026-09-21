import Link from "next/link";
import { getProducts } from "@/lib/products";
import { FeaturedScrollRow } from "@/components/FeaturedScrollRow";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await getProducts();

  const crocsProducts = products.filter((p) => p.category === "crocs");

  const crocsImg1 =
    crocsProducts[0]?.hero ||
    "https://res.cloudinary.com/tp1vyxi3/image/upload/v1789791756/ChatGPT_Image_Sep_18_2026_09_22_00_PM.png";
  const crocsImg2 =
    crocsProducts[1]?.hero ||
    crocsProducts[0]?.gallery[1] ||
    "https://res.cloudinary.com/tp1vyxi3/image/upload/v1789371558/ChatGPT_Image_Sep_13_2026_05_44_14_AM.png";

  return (
    <div className="page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-eyebrow">
            <span className="eyebrow-accent">Comfort</span>
            <span className="eyebrow-divider">x</span>
            <span className="eyebrow-light">Style</span>
          </div>

          <h1 className="hero-title">EVERYDAY COMFORT.</h1>

          <p className="hero-subtext">
            Crocs designed for your daily rotation. Comfort meets style.
          </p>

          <div className="hero-ctas">
            <Link href="/crocs" className="btn btn-hero-outline">
              SHOP ALL CROCS
            </Link>
            <Link href="/products?tag=NEW" className="btn btn-hero-filled">
              SHOP NEW BLACKS
            </Link>
          </div>

          <div className="hero-features">
            <div className="feature-item">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feature-icon">
                <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
                <path d="M15 18H9" />
                <path d="M19 18h2a1 1 0 0 0 1-1v-5l-3-4h-4v10" />
                <circle cx="7" cy="18" r="2" />
                <circle cx="17" cy="18" r="2" />
              </svg>
              <div className="feature-label">
                <span>Fast</span>
                <span>Delivery</span>
              </div>
            </div>

            <div className="feature-item">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feature-icon">
                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.8 17 5 19 5a1 1 0 0 1 1 1z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <div className="feature-label">
                <span>Secure</span>
                <span>Shopping</span>
              </div>
            </div>

            <div className="feature-item">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feature-icon">
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
              <div className="feature-label">
                <span>Easy</span>
                <span>Returns</span>
              </div>
            </div>

            <div className="feature-item">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feature-icon">
                <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
              </svg>
              <div className="feature-label">
                <span>Customer</span>
                <span>Support</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <div className="wrap" id="featured-products">
        <section className="section">
          <div className="section-head">
            <h2>Featured Products</h2>
            <Link href="/products" className="view-all">
              View All &rarr;
            </Link>
          </div>

          <FeaturedScrollRow products={products.slice(0, 10)} />
        </section>
      </div>

      {/* Block A: Categories (Crocs & Trousers only) */}
      <div className="wrap" id="shop-categories" style={{ marginBottom: 64 }}>
        <section className="category-section">
          <div className="section-head" style={{ marginBottom: 20 }}>
            <h2>Shop by Category</h2>
          </div>
          <div className="category-block-a-grid">
            {/* Tile 1: Crocs Category Link */}
            <Link href="/crocs" className="cat-tile cat-tile-clickable cat-tile-cat w-full">
              <div
                className="cat-tile-bg"
                style={{
                  backgroundImage: `url('https://res.cloudinary.com/tp1vyxi3/image/upload/v1789791756/ChatGPT_Image_Sep_18_2026_09_22_00_PM.png')`,
                  backgroundPosition: "center",
                }}
              />
              <div className="cat-tile-overlay">
                <span className="cat-tile-eyebrow">Category</span>
                <h3 className="cat-tile-title">Crocs</h3>
                <span className="cat-tile-link">
                  Explore Collection <span className="cat-tile-arrow">&rarr;</span>
                </span>
              </div>
            </Link>

            {/* Tile 2: Trousers Category Link */}
            <Link href="/trousers" className="cat-tile cat-tile-clickable cat-tile-cat w-full">
              <div
                className="cat-tile-bg"
                style={{
                  backgroundImage: `url('https://res.cloudinary.com/tp1vyxi3/image/upload/v1789791884/High_Waist_Wide_Leg_Pants_Women_s_Loose_Fit_Straight_Casual_Long_Trousers_with_Slimming_Effect.jpg')`,
                  backgroundPosition: "center 25%",
                }}
              />
              <div className="cat-tile-overlay">
                <span className="cat-tile-eyebrow">Category</span>
                <h3 className="cat-tile-title">Trousers</h3>
                <span className="cat-tile-link">
                  Explore Collection <span className="cat-tile-arrow">&rarr;</span>
                </span>
              </div>
            </Link>
          </div>
        </section>
      </div>

      {/* Block B: Promo / Brand Showcase (4 Tiles in 2x2 Grid) */}
      <div className="wrap" style={{ marginBottom: 80 }}>
        <section className="promo-section">
          <div className="promo-block-b-grid">
            {/* Tile 1: Dark Logo Card */}
            <div className="cat-tile cat-tile-dark cat-tile-promo w-full">
              <div className="cat-tile-overlay">
                <div className="cat-brand">nanos.pk</div>
                <div className="cat-sub">CROCS / TROUSERS</div>
              </div>
            </div>

            {/* Tile 2: Comfort Image Card */}
            <div className="cat-tile cat-tile-promo w-full">
              <div
                className="cat-tile-bg"
                style={{
                  backgroundImage: `url('${crocsImg1}')`,
                  backgroundPosition: "center",
                }}
              />
              <div className="cat-tile-overlay">
                <div className="cat-line1">COMFORT</div>
                <div className="cat-line2" style={{ fontWeight: 400 }}>
                  IN EVERY STEP.
                </div>
              </div>
            </div>

            {/* Tile 3: Better Basics Image Card */}
            <div className="cat-tile cat-tile-promo w-full">
              <div
                className="cat-tile-bg"
                style={{
                  backgroundImage: `url('${crocsImg2}')`,
                  backgroundPosition: "center",
                }}
              />
              <div className="cat-tile-overlay">
                <div className="cat-line1">BETTER</div>
                <div className="cat-line2">BASICS.</div>
              </div>
            </div>

            {/* Tile 4: Lime Card */}
            <div className="cat-tile cat-tile-lime cat-tile-promo w-full">
              <div className="cat-tile-overlay">
                <div className="cat-line1">KEEP IT SIMPLE.</div>
                <div className="cat-line2">WEAR IT YOUR WAY.</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Editorial Banner */}
      <section className="editorial-banner">
        <div className="wrap">
          <div className="editorial-content">
            <h2>Built for Pakistan. Priced for Everyone.</h2>
            <p>
              Premium lightweight clogs &amp; relaxed utility trousers engineered for everyday movement and built to last.
            </p>
            <Link href="/products" className="btn btn-primary">
              Explore All Products &rarr;
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
