"use client";

import React, { useRef, useState, useEffect } from "react";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";

interface FeaturedScrollRowProps {
  products: Product[];
}

export function FeaturedScrollRow({ products }: FeaturedScrollRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll, { passive: true });
      window.addEventListener("resize", checkScroll);
    }
    return () => {
      if (el) el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [products]);

  const scrollByAmount = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = Math.max(scrollRef.current.clientWidth * 0.75, 260);
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (!products || products.length === 0) {
    return null;
  }

  return (
    <div className="featured-scroll-wrapper">
      {/* Scroll Navigation Arrows */}
      {canScrollLeft && (
        <button
          type="button"
          className="featured-scroll-btn featured-scroll-prev"
          onClick={() => scrollByAmount("left")}
          aria-label="Scroll left"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}

      {canScrollRight && (
        <button
          type="button"
          className="featured-scroll-btn featured-scroll-next"
          onClick={() => scrollByAmount("right")}
          aria-label="Scroll right"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 15 6" />
          </svg>
        </button>
      )}

      {/* Scrollable Track */}
      <div className="featured-scroll-track" ref={scrollRef}>
        {products.map((product) => (
          <div key={product.id} className="featured-scroll-box">
            <ProductCard
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
          </div>
        ))}
      </div>
    </div>
  );
}
