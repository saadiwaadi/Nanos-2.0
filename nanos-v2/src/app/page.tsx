import Link from "next/link";
import { getProducts } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await getProducts();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Hero Banner Section */}
      <section className="relative bg-neutral-900 text-white overflow-hidden py-20 px-6 sm:px-12 md:py-32">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="relative mx-auto max-w-5xl text-center space-y-6">
          <span className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium tracking-wider text-neutral-300 uppercase">
            New Collection 2026
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl md:text-7xl">
            Comfort. Redefined.
          </h1>
          <p className="mx-auto max-w-2xl text-base text-neutral-300 sm:text-lg md:text-xl">
            Premium Crocs &amp; Trousers — COD across Pakistan
          </p>
          <div className="pt-4">
            <Link
              href="/products"
              className="inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-sm font-semibold text-black shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              Shop Collection
            </Link>
          </div>
        </div>
      </section>

      {/* Main Content / Featured Products */}
      <main className="flex-1 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 pb-4 border-b border-neutral-200">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              Featured Products
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Explore our latest arrivals and bestsellers
            </p>
          </div>
          <Link
            href="/products"
            className="mt-4 sm:mt-0 text-sm font-semibold text-black hover:underline inline-flex items-center gap-1"
          >
            View All Products &rarr;
          </Link>
        </div>

        {/* Featured Grid - All products as ProductCard components */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {products.map((product) => (
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
      </main>

      {/* Simple Footer */}
      <footer className="border-t border-neutral-200 bg-neutral-50 py-12 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <h3 className="text-lg font-bold text-neutral-900 tracking-wider uppercase">
              Nanos
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              Premium Crocs &amp; Trousers — COD across Pakistan
            </p>
          </div>
          <p className="text-xs text-neutral-400">
            &copy; {new Date().getFullYear()} Nanos. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
