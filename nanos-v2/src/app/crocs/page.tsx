import { getProducts } from "@/lib/products";
import { FilteredGrid } from "@/components/FilteredGrid";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CrocsPage() {
  const all = await getProducts();
  const crocs = all.filter((p) => p.category === "crocs");

  return (
    <div className="page">
      <div className="wrap">
        <div className="breadcrumb">
          <Link href="/">Home</Link>
          <span className="sep">/</span>
          <span className="current">Crocs</span>
        </div>
        <div className="category-hero">
          <h1>Crocs</h1>
          <p>Premium clogs built for all-day comfort. Ventilated, lightweight, and yours.</p>
        </div>
        <FilteredGrid products={crocs} hideFilter />
      </div>
    </div>
  );
}
