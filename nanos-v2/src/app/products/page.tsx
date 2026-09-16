import { getProducts } from "@/lib/products";
import { FilteredGrid } from "@/components/FilteredGrid";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight sm:text-4xl">
            Shop
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Browse our full range of footwear and apparel
          </p>
        </header>

        {/* Filtered Grid Client Component */}
        <FilteredGrid products={products} />
      </div>
    </div>
  );
}
