import Link from "next/link";
import { getProducts } from "@/lib/products";
import { getHomePageConfig } from "@/lib/homepage";
import { FeaturedScrollRow } from "@/components/FeaturedScrollRow";
import { ProductCard } from "@/components/ProductCard";
import { ScrollingBanner } from "@/components/ScrollingBanner";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [products, homeConfig] = await Promise.all([
    getProducts(),
    getHomePageConfig(),
  ]);

  const productMap = new Map(products.map((p) => [p.id, p]));

  const crocsProducts = products.filter((p) => p.category === "crocs");
  const fallbackCrocsImg1 =
    crocsProducts[0]?.hero ||
    "https://res.cloudinary.com/tp1vyxi3/image/upload/v1789791756/ChatGPT_Image_Sep_18_2026_09_22_00_PM.png";
  const fallbackCrocsImg2 =
    crocsProducts[1]?.hero ||
    crocsProducts[0]?.gallery[1] ||
    "https://res.cloudinary.com/tp1vyxi3/image/upload/v1789371558/ChatGPT_Image_Sep_13_2026_05_44_14_AM.png";

  return (
    <div className="page">
      {/* ─── HERO SECTION ─── */}
      {!homeConfig.hero.isHidden && (
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-eyebrow">
              <span className="eyebrow-accent">{homeConfig.hero.eyebrowPart1}</span>
              <span className="eyebrow-divider">{homeConfig.hero.eyebrowDivider}</span>
              <span className="eyebrow-light">{homeConfig.hero.eyebrowPart2}</span>
            </div>

            <h1 className="hero-title">{homeConfig.hero.title}</h1>

            <p className="hero-subtext">{homeConfig.hero.subtext}</p>

            <div className="hero-ctas">
              {homeConfig.hero.buttons
                .filter((btn) => !btn.isHidden)
                .map((btn) => {
                  let btnClass = "btn btn-hero-outline";
                  if (btn.style === "filled") btnClass = "btn btn-hero-filled";
                  else if (btn.style === "lime" || btn.style === "primary") btnClass = "btn btn-primary";
                  return (
                    <Link key={btn.id} href={btn.url} className={btnClass}>
                      {btn.label}
                    </Link>
                  );
                })}
            </div>

            <div className="hero-features">
              {homeConfig.hero.features
                .filter((feat) => !feat.isHidden)
                .map((feat) => (
                  <div key={feat.id} className="feature-item">
                    {feat.icon === "truck" && (
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feature-icon">
                        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
                        <path d="M15 18H9" />
                        <path d="M19 18h2a1 1 0 0 0 1-1v-5l-3-4h-4v10" />
                        <circle cx="7" cy="18" r="2" />
                        <circle cx="17" cy="18" r="2" />
                      </svg>
                    )}
                    {feat.icon === "shield" && (
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feature-icon">
                        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.8 17 5 19 5a1 1 0 0 1 1 1z" />
                        <path d="m9 12 2 2 4-4" />
                      </svg>
                    )}
                    {feat.icon === "repeat" && (
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feature-icon">
                        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                        <path d="M21 3v5h-5" />
                        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                        <path d="M3 21v-5h5" />
                      </svg>
                    )}
                    {feat.icon === "headset" && (
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feature-icon">
                        <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
                      </svg>
                    )}
                    <div className="feature-label">
                      <span>{feat.line1}</span>
                      <span>{feat.line2}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── DYNAMIC PRODUCT SECTIONS ─── */}
      {homeConfig.productSections
        .filter((sec) => !sec.isHidden)
        .map((sec) => {
          let secProducts = sec.products.length > 0
            ? (sec.products
                .filter((p) => !p.isHidden)
                .map((p) => productMap.get(p.productId))
                .filter(Boolean) as typeof products)
            : products.slice(0, 10);

          if (secProducts.length === 0 && products.length > 0) {
            secProducts = products.slice(0, 10);
          }

          return (
            <div key={sec.id} className="wrap" id={sec.id} style={{ marginBottom: 48 }}>
              <section className="section">
                <div className="section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h2>{sec.title}</h2>
                    {sec.subtitle && (
                      <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--text-soft, #888)" }}>
                        {sec.subtitle}
                      </p>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    {(sec.buttons || [])
                      .filter((btn) => !btn.isHidden)
                      .map((btn) => (
                        <Link
                          key={btn.id}
                          href={btn.url}
                          className={btn.style === "primary" ? "btn btn-primary" : "view-all"}
                        >
                          {btn.label}
                        </Link>
                      ))}
                  </div>
                </div>

                {sec.layout === "grid" ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                      gap: 20,
                      marginTop: 20,
                    }}
                  >
                    {secProducts.map((p) => (
                      <ProductCard key={p.id} {...p} />
                    ))}
                  </div>
                ) : (
                  <FeaturedScrollRow products={secProducts} />
                )}
              </section>
            </div>
          );
        })}

      {/* ─── BLOCK A: CATEGORIES ─── */}
      {!homeConfig.categorySection.isHidden && (
        <div className="wrap" id={homeConfig.categorySection.id || "shop-categories"} style={{ marginBottom: 64 }}>
          <section className="category-section">
            <div className="section-head" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2>{homeConfig.categorySection.title || "Shop by Category"}</h2>
              <div style={{ display: "flex", gap: 12 }}>
                {(homeConfig.categorySection.buttons || [])
                  .filter((b) => !b.isHidden)
                  .map((b) => (
                    <Link key={b.id} href={b.url} className="view-all">
                      {b.label}
                    </Link>
                  ))}
              </div>
            </div>

            <div className="category-block-a-grid">
              {homeConfig.categorySection.tiles
                .filter((tile) => !tile.isHidden)
                .map((tile) => (
                  <Link key={tile.id} href={tile.link} className="cat-tile cat-tile-clickable cat-tile-cat w-full">
                    <div
                      className="cat-tile-bg"
                      style={{
                        backgroundImage: `url('${tile.image}')`,
                        backgroundPosition: tile.backgroundPosition || "center",
                      }}
                    />
                    <div className="cat-tile-overlay">
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <span className="cat-tile-eyebrow">{tile.eyebrow || "Category"}</span>
                        {tile.badge && (
                          <span
                            style={{
                              background: "var(--accent, #C8FF00)",
                              color: "#111",
                              fontSize: "10px",
                              fontWeight: 800,
                              letterSpacing: "0.1em",
                              padding: "3px 9px",
                              borderRadius: "12px",
                              textTransform: "uppercase",
                            }}
                          >
                            {tile.badge}
                          </span>
                        )}
                      </div>
                      <h3 className="cat-tile-title">{tile.title}</h3>
                      <span className="cat-tile-link">
                        Explore Collection <span className="cat-tile-arrow">&rarr;</span>
                      </span>
                    </div>
                  </Link>
                ))}
            </div>
          </section>
        </div>
      )}

      {/* ─── CONTINUOUS SCROLLING BANNER ─── */}
      <ScrollingBanner config={homeConfig.scrollingBanner} />

      {/* ─── BLOCK B: PROMO / BRAND SHOWCASE ─── */}
      {!homeConfig.promoSection.isHidden && (
        <div className="wrap" style={{ marginBottom: 80 }}>
          <section className="promo-section">
            <div className="promo-block-b-grid">
              {homeConfig.promoSection.tiles
                .filter((tile) => !tile.isHidden)
                .map((tile, idx) => {
                  if (tile.type === "dark") {
                    return (
                      <div key={tile.id || idx} className="cat-tile cat-tile-dark cat-tile-promo w-full">
                        <div className="cat-tile-overlay">
                          <div className="cat-brand">{tile.brand || "nanos.pk"}</div>
                          <div className="cat-sub">{tile.sub || "CROCS / TROUSERS"}</div>
                        </div>
                      </div>
                    );
                  }

                  if (tile.type === "lime") {
                    return (
                      <div key={tile.id || idx} className="cat-tile cat-tile-lime cat-tile-promo w-full">
                        <div className="cat-tile-overlay">
                          <div className="cat-line1">{tile.line1 || "KEEP IT SIMPLE."}</div>
                          <div className="cat-line2">{tile.line2 || "WEAR IT YOUR WAY."}</div>
                        </div>
                      </div>
                    );
                  }

                  // Default image tile
                  const bgImg = tile.image || (idx === 1 ? fallbackCrocsImg1 : fallbackCrocsImg2);
                  return (
                    <div key={tile.id || idx} className="cat-tile cat-tile-promo w-full">
                      <div
                        className="cat-tile-bg"
                        style={{
                          backgroundImage: `url('${bgImg}')`,
                          backgroundPosition: "center",
                        }}
                      />
                      <div className="cat-tile-overlay">
                        <div className="cat-line1">{tile.line1}</div>
                        <div className="cat-line2" style={{ fontWeight: 400 }}>
                          {tile.line2}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        </div>
      )}

      {/* ─── EDITORIAL BANNER ─── */}
      {!homeConfig.editorialSection.isHidden && (
        <section className="editorial-banner">
          <div className="wrap">
            <div className="editorial-content">
              <h2>{homeConfig.editorialSection.title}</h2>
              <p>{homeConfig.editorialSection.text}</p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 24 }}>
                {homeConfig.editorialSection.buttons
                  .filter((b) => !b.isHidden)
                  .map((b) => (
                    <Link
                      key={b.id}
                      href={b.url}
                      className={b.style === "outline" ? "btn btn-outline" : "btn btn-primary"}
                    >
                      {b.label}
                    </Link>
                  ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
