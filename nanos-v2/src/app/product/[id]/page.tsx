import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductById, getProducts } from "@/lib/products";
import { PdpActions } from "@/components/PdpActions";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  const allProducts = await getProducts();
  const related = allProducts
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  const categoryLabel = product.category === "crocs" ? "Crocs" : "Trousers";

  return (
    <div className="page">
      <div className="wrap">
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <Link href="/">Home</Link>
          <span className="sep">/</span>
          <Link href={`/${product.category}`}>{categoryLabel}</Link>
          <span className="sep">/</span>
          <span className="current">{product.name}</span>
        </div>

        {/* PDP Main Content */}
        <PdpActions product={product} />

        {/* You May Also Like Section */}
        {related.length > 0 && (
          <section className="section">
            <div className="section-head">
              <h2>You may also like</h2>
            </div>
            <div className="product-grid">
              {related.map((item) => (
                <ProductCard
                  key={item.id}
                  id={item.id}
                  sku={item.sku}
                  name={item.name}
                  price={item.price}
                  oldPrice={item.oldPrice}
                  hero={item.hero}
                  tag={item.tag}
                  isSale={item.isSale}
                  category={item.category}
                  colors={item.colors}
                  sizes={item.sizes}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
