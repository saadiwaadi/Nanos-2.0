import { notFound } from "next/navigation";
import { getProductById } from "@/lib/products";
import { fmtPrice } from "@/lib/format";
import { ImageGallery } from "@/components/ImageGallery";
import { PdpActions } from "@/components/PdpActions";

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Left Column: Image Gallery */}
          <ImageGallery hero={product.hero} gallery={product.gallery} />

          {/* Right Column: Details & Actions */}
          <div className="flex flex-col space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
                  {product.category}
                </span>
                {product.tag && (
                  <span className="rounded-md bg-black px-2 py-0.5 text-[10px] font-semibold text-white uppercase tracking-wider">
                    {product.tag}
                  </span>
                )}
                {product.isSale && (
                  <span className="rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-semibold text-white uppercase tracking-wider">
                    SALE
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
                {product.name}
              </h1>
              <p className="mt-1 text-xs text-neutral-400">SKU: {product.sku}</p>
            </div>

            {/* Price Display */}
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-neutral-900 sm:text-3xl">
                {fmtPrice(product.price)}
              </span>
              {product.isSale && product.oldPrice && (
                <span className="text-base text-neutral-400 line-through">
                  {fmtPrice(product.oldPrice)}
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-neutral-600 leading-relaxed">
              {product.description}
            </p>

            {/* Color, Size, Quantity & Action Buttons */}
            <PdpActions colors={product.colors} sizes={product.sizes} />
          </div>
        </div>
      </div>
    </div>
  );
}
