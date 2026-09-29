import { notFound } from "next/navigation";
import { getProductById, getProducts } from "@/lib/products";
import { getProductBundlePricing } from "@/lib/bundle-pricing";
import { ProductDetailView } from "@/components/ProductDetailView";

export const dynamic = "force-dynamic";

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  const [allProducts, bundlePricing] = await Promise.all([
    getProducts(),
    getProductBundlePricing(product.id, product.price),
  ]);

  const related = allProducts
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  return (
    <ProductDetailView
      initialProduct={product}
      bundlePricing={bundlePricing}
      initialRelated={related}
    />
  );
}
