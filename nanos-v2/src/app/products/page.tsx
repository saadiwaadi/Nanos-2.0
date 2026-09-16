import { getProducts } from "@/lib/products";
import { FilteredGrid } from "@/components/FilteredGrid";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <div className="page">
      <div className="wrap">
        <div className="category-hero">
          <h1>Shop All</h1>
          <p>Explore our complete range of crocs and trousers designed for everyday comfort.</p>
        </div>
        <FilteredGrid products={products} />
      </div>
    </div>
  );
}
