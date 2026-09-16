import { getProducts } from "@/lib/products";
import { FilteredGrid } from "@/components/FilteredGrid";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TrousersPage() {
  const all = await getProducts();
  const trousers = all.filter((p) => p.category === "trousers");

  return (
    <div className="page">
      <div className="wrap">
        <div className="breadcrumb">
          <Link href="/">Home</Link>
          <span className="sep">/</span>
          <span className="current">Trousers</span>
        </div>
        <div className="category-hero">
          <h1>Trousers</h1>
          <p>Relaxed fits and utility cuts designed for your everyday rotation.</p>
        </div>
        <FilteredGrid products={trousers} hideFilter />
      </div>
    </div>
  );
}
