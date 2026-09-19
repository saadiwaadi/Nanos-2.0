import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

// Fallback memory store when DB is offline
export const memoryAdminProducts = new Map<string, any>();

function parseJson<T>(val: any): T[] {
  if (Array.isArray(val)) return val;
  if (typeof val !== "string") return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  try {
    const rows = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        stockLevels: true,
        productColors: true,
      },
    });

    const products = rows.map((p) => {
      const stockLevelQty = p.stockLevels.reduce((sum, s) => sum + s.quantity, 0);

      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        slug: p.id,
        category: p.category,
        tag: p.tag ?? null,
        price: p.price,
        oldPrice: p.oldPrice ?? null,
        isSale: p.isSale,
        description: p.description,
        hero: p.hero,
        gallery: parseJson<string>(p.gallery),
        sizes: parseJson<string>(p.sizes),
        colors: parseJson<any>(p.colors),
        productColors: p.productColors,
        stockLevels: p.stockLevels,
        totalStock: stockLevelQty,
        stockLevel: { quantity: stockLevelQty },
      };
    });

    return NextResponse.json({ products });
  } catch {
    // Memory fallback
    const products = Array.from(memoryAdminProducts.values());
    return NextResponse.json({ products });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  try {
    const body = await request.json();
    const {
      name,
      slug,
      category,
      price,
      description = "",
      hero = "",
      gallery = [],
      sizes = [],
      colors = [],
    } = body;

    if (!name || !price) {
      return NextResponse.json({ error: "Name and price are required." }, { status: 400 });
    }

    const productId = (slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).replace(/(^-|-$)/g, "");
    const sku = `${category.substring(0, 3).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const productData = {
      id: productId,
      sku,
      name,
      category,
      price: Number(price),
      description,
      hero,
      gallery: Array.isArray(gallery) ? gallery : [],
      sizes: Array.isArray(sizes) ? sizes : [],
      colors: Array.isArray(colors) ? colors : [],
      totalStock: 0,
      stockLevel: { quantity: 0 },
    };

    memoryAdminProducts.set(productId, productData);

    try {
      const created = await prisma.product.create({
        data: {
          id: productId,
          sku,
          name,
          category,
          price: Number(price),
          description,
          hero,
          gallery: JSON.stringify(gallery),
          sizes: JSON.stringify(sizes),
          colors: JSON.stringify(colors),
          stockLevels: {
            create: {
              color: "Standard",
              size: "Standard",
              quantity: 0,
            },
          },
        },
        include: {
          stockLevels: true,
          productColors: true,
        },
      });
      return NextResponse.json({ product: created }, { status: 201 });
    } catch {
      // Memory fallback
    }

    return NextResponse.json({ product: productData }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create product" }, { status: 500 });
  }
}
