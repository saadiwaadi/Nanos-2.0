import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items: any[] = Array.isArray(body) ? body : body?.items || [];

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const results = [];

    for (const item of items) {
      const { productId, color, size, qty = 1 } = item;
      const requestedQty = Math.max(1, parseInt(qty, 10) || 1);

      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { ignoreStock: true },
      });

      const variant = await prisma.stockLevel.findFirst({
        where: { productId, color, size },
        select: { quantity: true, ignoreStock: true },
      });

      if (!product || !variant) {
        results.push({
          productId,
          color,
          size,
          requestedQty,
          ok: false,
          available: 0,
        });
        continue;
      }

      const isIgnored = product.ignoreStock || variant.ignoreStock;
      const availableQty = isIgnored ? 999 : variant.quantity;
      const ok = isIgnored || availableQty >= requestedQty;

      results.push({
        productId,
        color,
        size,
        requestedQty,
        ok,
        available: availableQty,
      });
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Cart validation failed" },
      { status: 500 }
    );
  }
}
