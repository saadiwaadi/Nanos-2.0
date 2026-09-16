import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { memoryAdminProducts } from "../route";

export async function PATCH(
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
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.price !== undefined) updateData.price = Number(body.price);
    if (body.description !== undefined) updateData.description = body.description;
    if (body.hero !== undefined) updateData.hero = body.hero;
    if (body.gallery !== undefined) updateData.gallery = JSON.stringify(body.gallery);
    if (body.sizes !== undefined) updateData.sizes = JSON.stringify(body.sizes);
    if (body.colors !== undefined) updateData.colors = JSON.stringify(body.colors);

    // Memory update
    if (memoryAdminProducts.has(id)) {
      const existing = memoryAdminProducts.get(id);
      memoryAdminProducts.set(id, {
        ...existing,
        ...body,
        gallery: Array.isArray(body.gallery) ? body.gallery : existing.gallery,
        sizes: Array.isArray(body.sizes) ? body.sizes : existing.sizes,
        colors: Array.isArray(body.colors) ? body.colors : existing.colors,
      });
    }

    try {
      const updated = await prisma.product.update({
        where: { id },
        data: updateData,
      });

      return NextResponse.json({ product: updated });
    } catch {
      return NextResponse.json({ product: memoryAdminProducts.get(id) || updateData });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const { id } = await params;

  memoryAdminProducts.delete(id);

  try {
    await prisma.stockLevel.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });
  } catch {
    // Memory fallback
  }

  return NextResponse.json({ success: true });
}
