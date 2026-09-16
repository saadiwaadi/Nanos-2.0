import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Product } from "@/lib/types";

function parseJson<T>(val: string): T[] {
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toProduct(row: {
  id: string;
  sku: string;
  name: string;
  category: string;
  tag: string | null;
  price: number;
  oldPrice: number | null;
  description: string;
  rating: number;
  reviews: number;
  hero: string;
  isSale: boolean;
  colors: string;
  sizes: string;
  gallery: string;
}): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    tag: row.tag,
    price: row.price,
    oldPrice: row.oldPrice,
    description: row.description,
    rating: row.rating,
    reviews: row.reviews,
    hero: row.hero,
    isSale: row.isSale,
    colors: parseJson<{ name: string; hex: string }>(row.colors),
    sizes: parseJson<string>(row.sizes),
    gallery: parseJson<string>(row.gallery),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") || undefined;
  const sale = searchParams.get("sale") === "true";

  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (sale) where.isSale = true;

  try {
    const rows = await prisma.product.findMany({ where });
    return NextResponse.json(rows.map(toProduct));
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json(
      { error: { code: "FETCH_ERROR", message: "Failed to fetch products" } },
      { status: 500 }
    );
  }
}
