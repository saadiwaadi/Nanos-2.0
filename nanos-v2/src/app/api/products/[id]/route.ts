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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const row = await prisma.product.findUnique({ where: { id } });

    if (!row) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Product not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json(toProduct(row));
  } catch (error) {
    console.error("Failed to fetch product:", error);
    return NextResponse.json(
      { error: { code: "FETCH_ERROR", message: "Failed to fetch product" } },
      { status: 500 }
    );
  }
}
