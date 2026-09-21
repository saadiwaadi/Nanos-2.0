import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        ignoreStock: true,
        stockLevels: {
          select: {
            color: true,
            size: true,
            quantity: true,
            ignoreStock: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const pIgnore = product.ignoreStock;
    const variants = product.stockLevels.map((v) => {
      const vIgnore = v.ignoreStock;
      const isIgnored = pIgnore || vIgnore;
      const qty = v.quantity;
      const available = isIgnored || qty > 0;
      const low = !isIgnored && qty >= 1 && qty <= 3;

      return {
        color: v.color,
        size: v.size,
        available,
        low,
      };
    });

    return NextResponse.json({ variants }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch availability" }, { status: 500 });
  }
}
