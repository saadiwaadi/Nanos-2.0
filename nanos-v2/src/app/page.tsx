import Link from "next/link";
import { getProducts } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await getProducts();

  const crocsProducts = products.filter((p) => p.category === "crocs");
  const trouserProducts = products.filter((p) => p.category === "trousers");

  const crocsImg1 =
    crocsProducts[0]?.hero ||
    "https://res.cloudinary.com/tp1vyxi3/image/upload/v1789376228/ChatGPT_Image_Sep_14_2026_01_04_47_AM.png";
  const crocsImg2 =
    crocsProducts[1]?.hero ||
    crocsProducts[0]?.gallery[1] ||
    "https://res.cloudinary.com/tp1vyxi3/image/upload/v1789371558/ChatGPT_Image_Sep_13_2026_05_44_14_AM.png";

  const trouserImg1 =
    trouserProducts[0]?.hero ||
    "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&h=800&fit=crop";
  const trouserImg2 =
    trouserProducts[1]?.hero ||
    trouserProducts[0]?.gallery[1] ||
    "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800&h=800&fit=crop";

  return (
    <div className="page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-eyebrow">
            <span className="lime-tick" />
            FRESH DROP 2026
          </div>
          <h1>Comfort.<br />Redefined.</h1>
          <p>
            Everyday Crocs &amp; Trousers built for your rotation. Premium quality, cash on delivery across Pakistan.
          </p>
        </div>
        <div
          className="hero-image"
          style={{
            backgroundImage: `url('https://res.cloudinary.com/tp1vyxi3/image/upload/v1789376228/ChatGPT_Image_Sep_14_2026_01_04_47_AM.png')`,
          }}
        />
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

          <div className="product-grid">
            {products.slice(0, 4).map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                sku={product.sku}
                name={product.name}
                price={product.price}
                oldPrice={product.oldPrice}
                hero={product.hero}
                tag={product.tag}
                isSale={product.isSale}
                category={product.category}
                colors={product.colors}
                sizes={product.sizes}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Category Showcase */}
      <div className="wrap" style={{ marginBottom: 64 }}>
        <section className="category-showcase">
          <Link href="/crocs" className="category-box">
            <div
              className="category-box-bg"
              style={{
                backgroundImage: `url('https://res.cloudinary.com/tp1vyxi3/image/upload/v1789376228/ChatGPT_Image_Sep_14_2026_01_04_47_AM.png')`,
              }}
            />
            <div className="category-box-overlay">
              <span className="category-box-eyebrow">Category</span>
              <h3>Crocs</h3>
              <span className="category-box-link">Explore Collection &rarr;</span>
            </div>
          </Link>

          <Link href="/trousers" className="category-box">
            <div
              className="category-box-bg"
              style={{
                backgroundImage: `url('https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&h=800&fit=crop')`,
              }}
            />
            <div className="category-box-overlay">
              <span className="category-box-eyebrow">Category</span>
              <h3>Trousers</h3>
              <span className="category-box-link">Explore Collection &rarr;</span>
            </div>
          </Link>
        </section>
      </div>

      {/* Editorial Image Grid */}
      <div className="wrap" style={{ marginBottom: 64 }}>
        <div className="editorial-grid">
          {/* Card 1: Dark Logo Card */}
          <div className="editorial-card editorial-card-dark">
            <div className="brand">nanos.pk</div>
            <div className="sub">CROCS / TROUSERS</div>
          </div>

          {/* Card 2: Crocs Image Card */}
          <div className="editorial-card">
            <div
              className="editorial-card-bg"
              style={{ backgroundImage: `url('${crocsImg1}')` }}
            />
            <div className="editorial-card-overlay">
              <div className="line1">COMFORT</div>
              <div className="line2" style={{ fontWeight: 400 }}>
                IN EVERY STEP.
              </div>
            </div>
          </div>

          {/* Card 3: Crocs Image Card */}
          <div className="editorial-card">
            <div
              className="editorial-card-bg"
              style={{ backgroundImage: `url('${crocsImg2}')` }}
            />
            <div className="editorial-card-overlay">
              <div className="line1">BETTER</div>
              <div className="line2">BASICS.</div>
            </div>
          </div>

          {/* Card 4: Trousers / Slides Image Card */}
          <div className="editorial-card">
            <div
              className="editorial-card-bg"
              style={{ backgroundImage: `url('${trouserImg1}')` }}
            />
            <div className="editorial-card-overlay">
              <div className="line1">SIMPLE STYLES.</div>
              <div className="line2">BIGGER DAYS.</div>
            </div>
          </div>

          {/* Card 5: Trousers Image Card (no text) */}
          <div className="editorial-card">
            <div
              className="editorial-card-bg"
              style={{ backgroundImage: `url('${trouserImg2}')` }}
            />
          </div>

          {/* Card 6: Lime Card */}
          <div className="editorial-card editorial-card-lime">
            <div className="line1">KEEP IT SIMPLE.</div>
            <div className="line2">WEAR IT YOUR WAY.</div>
          </div>
        </div>
      </div>

      {/* Editorial Banner */}
      <section className="editorial-banner">
        <div className="editorial-content">
          <h2>Built for Pakistan. Priced for Everyone.</h2>
          <p>
            Premium lightweight clogs &amp; relaxed utility trousers engineered for everyday movement and built to last.
          </p>
          <Link href="/products" className="btn btn-primary">
            Explore All Products &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}
