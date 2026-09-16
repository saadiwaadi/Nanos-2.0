import Link from "next/link";
import { getProducts } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await getProducts();

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
          </p>          <div className="hero-ctas">
            <Link href="/crocs" className="btn btn-primary">
              Shop Crocs
            </Link>
            <Link href="/trousers" className="btn btn-secondary">
              Shop Trousers
            </Link>
          </div>
        </div>
        <div
          className="hero-image"
          style={{
            backgroundImage: `url('https://res.cloudinary.com/tp1vyxi3/image/upload/v1789376228/ChatGPT_Image_Sep_14_2026_01_04_47_AM.png')`,
          }}
        />
      </section>

      {/* Featured Products */}
      <div className="wrap">
        <section className="section">
          <div className="section-head">
            <h2>Featured Products</h2>
            <Link href="/products" className="view-all">
              View All &rarr;
            </Link>
          </div>

          <div className="product-grid">
            {products.map((product) => (
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
    </div>
  );
}
