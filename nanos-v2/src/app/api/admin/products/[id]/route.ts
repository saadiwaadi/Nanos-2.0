import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { memoryAdminProducts } from "../route";

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
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        productColors: true,
        stockLevels: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const stockLevelQty = product.stockLevels.reduce((sum, s) => sum + s.quantity, 0);
    const formatted = {
      ...product,
      gallery: typeof product.gallery === "string" ? JSON.parse(product.gallery) : product.gallery,
      sizes: typeof product.sizes === "string" ? JSON.parse(product.sizes) : product.sizes,
      colors: typeof product.colors === "string" ? JSON.parse(product.colors) : product.colors,
      totalStock: stockLevelQty,
      stockLevel: { quantity: stockLevelQty },
      variantCount: product.stockLevels.length,
      variants: product.stockLevels.map((s) => ({
        id: s.id,
        productId: s.productId,
        color: s.color,
        size: s.size,
        stock: s.quantity,
        quantity: s.quantity,
      })),
    };

    return NextResponse.json({ product: formatted });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch product" },
      { status: 500 }
    );
  }
}

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
    if (body.oldPrice !== undefined) updateData.oldPrice = body.oldPrice !== null ? Number(body.oldPrice) : null;
    if (body.tag !== undefined) updateData.tag = body.tag;
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
        include: {
          productColors: true,
          stockLevels: true,
        },
      });

      const stockLevelQty = updated.stockLevels.reduce((sum, s) => sum + s.quantity, 0);
      const formatted = {
        ...updated,
        gallery: typeof updated.gallery === "string" ? JSON.parse(updated.gallery) : updated.gallery,
        sizes: typeof updated.sizes === "string" ? JSON.parse(updated.sizes) : updated.sizes,
        colors: typeof updated.colors === "string" ? JSON.parse(updated.colors) : updated.colors,
        totalStock: stockLevelQty,
        stockLevel: { quantity: stockLevelQty },
        variantCount: updated.stockLevels.length,
        variants: updated.stockLevels.map((s) => ({
          id: s.id,
          productId: s.productId,
          color: s.color,
          size: s.size,
          stock: s.quantity,
          quantity: s.quantity,
        })),
      };

      return NextResponse.json({ product: formatted });
    } catch (dbErr: any) {
      console.error("DB update error in PATCH /api/admin/products/[id]:", dbErr);
      return NextResponse.json(
        { error: dbErr.message || "Failed to update product in database" },
        { status: 500 }
      );
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
    await prisma.productColor.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });
  } catch {
    // Memory fallback
  }

  return NextResponse.json({ success: true });
}
