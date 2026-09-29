"use client";

import Link from "next/link";
import type { Product } from "@/lib/types";
import { PdpActions, BundlePricingInfo } from "@/components/PdpActions";
import { ProductCard } from "@/components/ProductCard";
import { useSWR } from "@/lib/swr";

interface ProductDetailViewProps {
  initialProduct: Product;
  bundlePricing: BundlePricingInfo;
  initialRelated: Product[];
}

async function fetchProductDetailApi(id: string): Promise<Product> {
  const res = await fetch(`/api/products/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new Error("Failed to load product detail");
  }
  return (await res.json()) as Product;
}

export function ProductDetailView({
  initialProduct,
  bundlePricing,
  initialRelated,
}: ProductDetailViewProps) {
  // SWR hook for product detail: instant render from cache on returning visits, 60s background revalidation
  const { data: cachedProduct } = useSWR<Product>(
    `product:${initialProduct.id}`,
    () => fetchProductDetailApi(initialProduct.id),
    {
      initialData: initialProduct,
      staleTime: 60 * 1000,
    }
  );

  const product = cachedProduct || initialProduct;
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
        <PdpActions product={product} bundlePricing={bundlePricing} />

        {/* You May Also Like Section */}
        {initialRelated.length > 0 && (
          <section className="section">
            <div className="section-head">
              <h2>You may also like</h2>
            </div>
            <div className="product-grid">
              {initialRelated.map((item) => (
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
