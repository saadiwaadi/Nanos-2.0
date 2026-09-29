"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";
import { ProductGridSkeleton } from "@/components/ProductCardSkeleton";
import { useSWR } from "@/lib/swr";

interface FilteredGridProps {
  products: Product[];
  hideFilter?: boolean;
  category?: "all" | "crocs" | "trousers";
}

async function fetchProductsApi(category?: string, sale?: boolean, tag?: string): Promise<Product[]> {
  const params = new URLSearchParams();
  if (category && category !== "all") params.set("category", category);
  if (sale) params.set("sale", "true");
  if (tag) params.set("tag", tag);

  const query = params.toString();
  const url = query ? `/api/products?${query}` : "/api/products";

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to load products");
  }
  return (await res.json()) as Product[];
}

export function FilteredGrid({
  products: initialProducts,
  hideFilter = false,
  category: initialCategory = "all",
}: FilteredGridProps) {
  const searchParams = useSearchParams();
  const tagParam = searchParams.get("tag")?.toUpperCase() || null;
  const saleParam = searchParams.get("sale") === "true";

  const [activeCategory, setActiveCategory] = useState<"all" | "crocs" | "trousers">(
    initialCategory
  );

  // SWR Cache key based on query parameters and active category
  const cacheKey = useMemo(() => {
    const parts = ["products"];
    if (activeCategory !== "all") parts.push(`category:${activeCategory}`);
    if (tagParam) parts.push(`tag:${tagParam}`);
    if (saleParam) parts.push("sale:true");
    return parts.join(":");
  }, [activeCategory, tagParam, saleParam]);

  // SWR Hook: renders cached products immediately, background revalidates after 60s
  const { data: cachedProducts, isLoading } = useSWR<Product[]>(
    cacheKey,
    () => fetchProductsApi(activeCategory, saleParam, tagParam || undefined),
    {
      initialData: initialProducts,
      staleTime: 60 * 1000, // 60s freshness
    }
  );

  const productsList = cachedProducts || initialProducts || [];

  // Filter products according to category, sale, or tag
  const filteredProducts = useMemo(() => {
    return productsList.filter((product) => {
      // Category filter
      if (!hideFilter && activeCategory !== "all") {
        if (product.category.toLowerCase() !== activeCategory) {
          return false;
        }
      }

      // Sale query filter (?sale=true or ?tag=SALE)
      if (saleParam || tagParam === "SALE") {
        const isSaleItem =
          product.isSale ||
          (product.oldPrice != null && product.oldPrice > product.price) ||
          product.tag?.toUpperCase() === "SALE";
        if (!isSaleItem) return false;
      } else if (tagParam) {
        // Tag query filter (?tag=NEW, etc.)
        if (product.tag?.toUpperCase() !== tagParam) {
          return false;
        }
      }

      return true;
    });
  }, [productsList, hideFilter, activeCategory, saleParam, tagParam]);

  // Loading skeleton on first-ever visit with empty cache
  if (isLoading && productsList.length === 0) {
    return (
      <div style={{ marginBottom: 64 }}>
        {!hideFilter && (
          <div className="category-toolbar">
            <div className="filter-chips">
              {(["all", "crocs", "trousers"] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`chip ${activeCategory === cat ? "active" : ""}`}
                  disabled
                >
                  {cat === "all" ? "All Products" : cat === "crocs" ? "Crocs" : "Trousers"}
                </button>
              ))}
            </div>
          </div>
        )}
        <ProductGridSkeleton count={8} />
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 64 }}>
      {/* Category Filter Chips */}
      {!hideFilter && (
        <div className="category-toolbar">
          <div className="filter-chips">
            {(["all", "crocs", "trousers"] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`chip ${activeCategory === cat ? "active" : ""}`}
              >
                {cat === "all" ? "All Products" : cat === "crocs" ? "Crocs" : "Trousers"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {filteredProducts.length === 0 ? (
        <div className="empty-state">
          <h2>No products found</h2>
          <p>
            {tagParam === "SALE" || saleParam
              ? "No items on sale at the moment. Check back soon!"
              : "Try switching categories to view available items."}
          </p>
        </div>
      ) : (
        <div className="product-grid">
          {filteredProducts.map((product) => (
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
      )}
    </div>
  );
}
