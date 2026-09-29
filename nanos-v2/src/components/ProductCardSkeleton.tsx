import React from "react";

export function ProductCardSkeleton() {
  return (
    <div
      className="product-card skeleton-card"
      style={{
        background: "var(--white, #fff)",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid var(--stone, #e7e5e4)",
      }}
    >
      <div
        style={{
          width: "100%",
          paddingTop: "100%",
          background: "var(--stone, #f5f5f4)",
          position: "relative",
          animation: "pulse 1.5s infinite ease-in-out",
        }}
      />
      <div className="product-info" style={{ padding: "16px 14px 14px" }}>
        {/* Title skeleton */}
        <div
          style={{
            width: "75%",
            height: 16,
            background: "var(--stone, #e7e5e4)",
            borderRadius: 4,
            marginBottom: 8,
            animation: "pulse 1.5s infinite ease-in-out",
          }}
        />
        {/* Category skeleton */}
        <div
          style={{
            width: "45%",
            height: 12,
            background: "var(--stone, #e7e5e4)",
            borderRadius: 4,
            marginBottom: 12,
            animation: "pulse 1.5s infinite ease-in-out",
          }}
        />
        {/* Price skeleton */}
        <div
          style={{
            width: "35%",
            height: 18,
            background: "var(--stone, #e7e5e4)",
            borderRadius: 4,
            marginBottom: 14,
            animation: "pulse 1.5s infinite ease-in-out",
          }}
        />
        {/* Action buttons skeleton */}
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <div
            style={{
              flex: 1,
              height: 38,
              background: "var(--stone, #e7e5e4)",
              borderRadius: 4,
              animation: "pulse 1.5s infinite ease-in-out",
            }}
          />
          <div
            style={{
              flex: 1,
              height: 38,
              background: "var(--stone, #e7e5e4)",
              borderRadius: 4,
              animation: "pulse 1.5s infinite ease-in-out",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="product-grid">
      {Array.from({ length: count }).map((_, idx) => (
        <ProductCardSkeleton key={idx} />
      ))}
    </div>
  );
}
