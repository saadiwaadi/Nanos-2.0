"use client";

import { useState } from "react";
import type { ProductColor } from "@/lib/types";

interface PdpActionsProps {
  colors: ProductColor[];
  sizes: string[];
}

export function PdpActions({ colors, sizes }: PdpActionsProps) {
  const [selectedColor, setSelectedColor] = useState<string>(
    colors[0]?.name || ""
  );
  const [selectedSize, setSelectedSize] = useState<string>(
    sizes[0] || ""
  );
  const [quantity, setQuantity] = useState<number>(1);

  return (
    <div className="space-y-6 pt-4 border-t border-neutral-200">
      {/* Color Selector */}
      {colors.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-neutral-900 mb-2">
            Color: <span className="font-normal text-neutral-600">{selectedColor}</span>
          </label>
          <div className="flex items-center gap-3">
            {colors.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setSelectedColor(c.name)}
                className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${
                  selectedColor === c.name
                    ? "border-black ring-2 ring-black ring-offset-2"
                    : "border-neutral-300 hover:border-neutral-500"
                }`}
                title={c.name}
              >
                <span
                  className="h-7 w-7 rounded-full border border-black/10"
                  style={{ backgroundColor: c.hex }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Size Selector */}
      {sizes.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-neutral-900 mb-2">
            Size: <span className="font-normal text-neutral-600">{selectedSize}</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSelectedSize(s)}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                  selectedSize === s
                    ? "border-black bg-black text-white"
                    : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quantity Stepper */}
      <div>
        <label className="block text-sm font-semibold text-neutral-900 mb-2">
          Quantity
        </label>
        <div className="inline-flex items-center rounded-lg border border-neutral-300 bg-white">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="px-3 py-2 text-neutral-600 hover:text-black font-semibold"
          >
            -
          </button>
          <span className="w-10 text-center text-sm font-semibold text-neutral-900">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            className="px-3 py-2 text-neutral-600 hover:text-black font-semibold"
          >
            +
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="button"
          className="flex-1 rounded-xl bg-black py-4 text-center text-sm font-semibold text-white shadow-md transition-all hover:bg-neutral-800 active:scale-98"
        >
          Add to Cart
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-6 py-4 text-sm font-semibold text-neutral-700 shadow-2xs transition-all hover:bg-neutral-50 hover:border-neutral-400"
        >
          Add to Wishlist
        </button>
      </div>

      {/* Stock & Delivery Note */}
      <div className="rounded-xl bg-neutral-50 p-4 border border-neutral-200">
        <p className="text-xs font-medium text-neutral-700 flex items-center gap-2">
          <svg
            className="h-4 w-4 text-emerald-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
          Cash on Delivery only — Free shipping across Pakistan
        </p>
      </div>
    </div>
  );
}
