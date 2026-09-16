"use client";

import { useState } from "react";
import Image from "next/image";

interface ImageGalleryProps {
  hero: string;
  gallery: string[];
}

export function ImageGallery({ hero, gallery }: ImageGalleryProps) {
  // Deduplicate and assemble all images starting with hero
  const allImages = Array.from(new Set([hero, ...gallery])).filter(Boolean);
  const [selectedImage, setSelectedImage] = useState(allImages[0] || hero);

  return (
    <div className="flex flex-col gap-4">
      {/* Main Image Display */}
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-neutral-100 border border-neutral-200 shadow-sm">
        <Image
          src={selectedImage}
          alt="Product image"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover object-center transition-all duration-300"
        />
      </div>

      {/* Thumbnail Strip */}
      {allImages.length > 1 && (
        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {allImages.map((img, idx) => (
            <button
              key={`${img}-${idx}`}
              type="button"
              onClick={() => setSelectedImage(img)}
              className={`relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100 border-2 transition-all ${
                selectedImage === img
                  ? "border-black shadow-xs scale-102"
                  : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <Image
                src={img}
                alt={`Thumbnail ${idx + 1}`}
                fill
                sizes="80px"
                className="object-cover object-center"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
