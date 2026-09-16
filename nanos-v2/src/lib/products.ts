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

export async function getProducts(): Promise<Product[]> {
  try {
    const rows = await prisma.product.findMany();
    return rows.map((row) => ({
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
    }));
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return [];
  }
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    const row = await prisma.product.findUnique({ where: { id } });
    if (!row) return null;
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
  } catch (error) {
    console.error(`Failed to fetch product ${id}:`, error);
    return null;
  }
}
