"use client";

import { useState } from "react";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";

interface FilteredGridProps {
  products: Product[];
}

export function FilteredGrid({ products }: FilteredGridProps) {
  const [activeCategory, setActiveCategory] = useState<"all" | "crocs" | "trousers">("all");

  const filteredProducts = products.filter((product) => {
    if (activeCategory === "all") return true;
    return product.category.toLowerCase() === activeCategory;
  });

  return (
    <div className="space-y-6">
      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
        {(["all", "crocs", "trousers"] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 text-sm font-medium rounded-lg capitalize transition-colors ${
              activeCategory === cat
                ? "bg-black text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
            }`}
          >
            {cat === "all" ? "All Products" : cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filteredProducts.length === 0 ? (
        <div className="py-12 text-center text-neutral-500">
          No products found in this category.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
