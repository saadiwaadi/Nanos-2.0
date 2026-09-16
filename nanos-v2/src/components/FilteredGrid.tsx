"use client";

import { useState } from "react";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";

interface FilteredGridProps {
  products: Product[];
  hideFilter?: boolean;
}

export function FilteredGrid({ products, hideFilter = false }: FilteredGridProps) {
  const [activeCategory, setActiveCategory] = useState<"all" | "crocs" | "trousers">("all");

  const filteredProducts = products.filter((product) => {
    if (hideFilter || activeCategory === "all") return true;
    return product.category.toLowerCase() === activeCategory;
  });

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
          <p>Try switching categories to view available items.</p>
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
