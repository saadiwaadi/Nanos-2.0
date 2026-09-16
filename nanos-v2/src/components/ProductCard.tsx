import Link from "next/link";
import Image from "next/image";
import { fmtPrice } from "@/lib/format";

export interface ProductCardProps {
  id: string;
  sku: string;
  name: string;
  price: number;
  oldPrice?: number | null;
  hero: string;
  tag?: string | null;
  isSale?: boolean;
  category: string;
}

export function ProductCard({
  id,
  name,
  price,
  oldPrice,
  hero,
  tag,
  isSale,
  category,
}: ProductCardProps) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs transition-all hover:shadow-md">
      {/* Image Container */}
      <Link href={`/products/${id}`} className="relative aspect-square w-full overflow-hidden bg-neutral-100">
        <Image
          src={hero}
          alt={name}
          fill
          sizes="(max-width: 768px) 50vw, 33vw"
          className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
        />

        {/* Badges Container */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1 z-10">
          {tag && (
            <span className="rounded-md bg-black px-2 py-0.5 text-[10px] font-semibold tracking-wider text-white uppercase">
              {tag}
            </span>
          )}
          {isSale && (
            <span className="rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-white uppercase">
              SALE
            </span>
          )}
        </div>

        {/* Wishlist Heart Icon */}
        <button
          type="button"
          aria-label="Add to wishlist"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-xs text-neutral-700 hover:text-rose-600 hover:bg-white transition-colors"
        >
          <svg
            className="h-4 w-4 fill-none stroke-current stroke-2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
            />
          </svg>
        </button>
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <span className="text-xs uppercase tracking-wider text-neutral-400 font-medium mb-1">
          {category}
        </span>
        <Link href={`/products/${id}`} className="group-hover:text-neutral-700 transition-colors">
          <h3 className="text-sm font-semibold text-neutral-900 line-clamp-1">{name}</h3>
        </Link>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-base font-bold text-neutral-900">
            {fmtPrice(price)}
          </span>
          {isSale && oldPrice && (
            <span className="text-xs text-neutral-400 line-through">
              {fmtPrice(oldPrice)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
