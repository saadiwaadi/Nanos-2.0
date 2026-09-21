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
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0 }}>Trousers</h1>
            <span
              style={{
                background: "var(--accent, #C8FF00)",
                color: "#111",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.12em",
                padding: "4px 12px",
                borderRadius: "20px",
                textTransform: "uppercase",
              }}
            >
              Coming Soon
            </span>
          </div>
          <p>Relaxed fits and utility cuts designed for your everyday rotation. Collection dropping soon!</p>
        </div>
        <FilteredGrid products={trousers} hideFilter />
      </div>
    </div>
  );
}
