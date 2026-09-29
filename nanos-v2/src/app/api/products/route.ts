import { NextResponse } from "next/server";
import { getProducts } from "@/lib/products";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category")?.toLowerCase() || undefined;
  const sale = searchParams.get("sale") === "true";
  const tag = searchParams.get("tag")?.toUpperCase() || undefined;

  try {
    let products = await getProducts();

    if (category && category !== "all") {
      products = products.filter((p) => p.category.toLowerCase() === category);
    }

    if (sale) {
      products = products.filter(
        (p) => p.isSale || (p.oldPrice != null && p.oldPrice > p.price)
      );
    }

    if (tag) {
      if (tag === "SALE") {
        products = products.filter(
          (p) => p.isSale || (p.oldPrice != null && p.oldPrice > p.price) || p.tag?.toUpperCase() === "SALE"
        );
      } else {
        products = products.filter((p) => p.tag?.toUpperCase() === tag);
      }
    }

    return NextResponse.json(products);
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json(
      { error: { code: "FETCH_ERROR", message: "Failed to fetch products" } },
      { status: 500 }
    );
  }
}
