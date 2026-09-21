import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const { id } = await params;

  try {
    const stockLevels = await prisma.stockLevel.findMany({
      where: { productId: id },
    });

    const mapped = stockLevels.map((s) => ({
      id: s.id,
      productId: s.productId,
      color: s.color,
      size: s.size,
      stock: s.quantity,
      quantity: s.quantity,
    }));

    const grouped = mapped.reduce((acc: Record<string, typeof mapped>, v) => {
      if (!acc[v.color]) acc[v.color] = [];
      acc[v.color].push(v);
      return acc;
    }, {});

    return NextResponse.json(grouped);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch variants" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const { id } = await params;

  try {
    const body = await request.json();

    if (Array.isArray(body)) {
      const results = await prisma.$transaction(
        body.map((item) => {
          const qty = typeof item.stock === "number" ? item.stock : item.quantity ?? 0;
          return prisma.stockLevel.upsert({
            where: {
              productId_color_size: {
                productId: id,
                color: item.color,
                size: item.size,
              },
            },
            update: { quantity: qty },
            create: {
              productId: id,
              color: item.color,
              size: item.size,
              quantity: qty,
            },
          });
        })
      );
      return NextResponse.json({ success: true, count: results.length });
    }

    const { color, size } = body;
    const qty = typeof body.stock === "number" ? body.stock : body.quantity;

    if (!color || !size || typeof qty !== "number") {
      return NextResponse.json(
        { error: "color, size, and stock/quantity (number) are required" },
        { status: 400 }
      );
    }

    const stockLevel = await prisma.stockLevel.upsert({
      where: {
        productId_color_size: {
          productId: id,
          color,
          size,
        },
      },
      update: { quantity: qty },
      create: {
        productId: id,
        color,
        size,
        quantity: qty,
      },
    });

    return NextResponse.json({
      ...stockLevel,
      stock: stockLevel.quantity,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to upsert variant" },
      { status: 500 }
    );
  }
}
