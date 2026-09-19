import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; color: string; size: string }> }
) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const { id, color: rawColor, size: rawSize } = await params;
  const color = decodeURIComponent(rawColor);
  const size = decodeURIComponent(rawSize);

  try {
    const body = await request.json();
    const qty = typeof body.stock === "number" ? body.stock : body.quantity;

    if (typeof qty !== "number") {
      return NextResponse.json(
        { error: "stock/quantity (number) is required" },
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
      { error: err.message || "Failed to update variant stock" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; color: string; size: string }> }
) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const { id, color: rawColor, size: rawSize } = await params;
  const color = decodeURIComponent(rawColor);
  const size = decodeURIComponent(rawSize);

  try {
    await prisma.stockLevel.delete({
      where: {
        productId_color_size: {
          productId: id,
          color,
          size,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to delete variant stock" },
      { status: 500 }
    );
  }
}
