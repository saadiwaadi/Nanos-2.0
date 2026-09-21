import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

function normalizeHex(hex: string): string | null {
  if (!hex || typeof hex !== "string") return null;
  let clean = hex.trim();
  if (clean.startsWith("#")) clean = clean.slice(1);
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return null;
  }
  return `#${clean.toUpperCase()}`;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; colorId: string }> }
) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const { id, colorId } = await params;

  try {
    const body = await request.json();
    const existingColor = await prisma.productColor.findUnique({
      where: { id: colorId },
    });

    if (!existingColor || existingColor.productId !== id) {
      return NextResponse.json({ error: "Color not found" }, { status: 404 });
    }

    const updateData: any = {};
    let newName = existingColor.name;

    if (body.hex !== undefined) {
      const normalizedHex = normalizeHex(body.hex);
      if (!normalizedHex) {
        return NextResponse.json(
          { error: "Invalid hex code. Please provide a valid 6-character hex color (e.g. #111111)." },
          { status: 400 }
        );
      }
      updateData.hex = normalizedHex;
    }

    if (body.name !== undefined) {
      const trimmed = typeof body.name === "string" ? body.name.trim() : "";
      if (!trimmed) {
        return NextResponse.json(
          { error: "Color name cannot be empty." },
          { status: 400 }
        );
      }
      if (trimmed.toLowerCase() !== existingColor.name.toLowerCase()) {
        const dup = await prisma.productColor.findFirst({
          where: {
            productId: id,
            id: { not: colorId },
            name: { equals: trimmed, mode: "insensitive" },
          },
        });
        if (dup) {
          return NextResponse.json(
            { error: `Another color named "${trimmed}" already exists.` },
            { status: 400 }
          );
        }
        updateData.name = trimmed;
        newName = trimmed;
      }
    }

    if (body.images !== undefined) {
      updateData.imagesJson = JSON.stringify(Array.isArray(body.images) ? body.images : []);
    } else if (body.imagesJson !== undefined) {
      updateData.imagesJson = typeof body.imagesJson === "string" ? body.imagesJson : JSON.stringify(body.imagesJson);
    }

    if (body.sortOrder !== undefined) {
      updateData.sortOrder = Number(body.sortOrder) || 0;
    }

    const updatedColor = await prisma.$transaction(async (tx) => {
      const updated = await tx.productColor.update({
        where: { id: colorId },
        data: updateData,
      });

      // If color name changed, update all StockLevel rows in the same transaction
      if (newName !== existingColor.name) {
        await tx.stockLevel.updateMany({
          where: { productId: id, color: existingColor.name },
          data: { color: newName },
        });
      }

      // Update Product.colors JSON
      const allColors = await tx.productColor.findMany({
        where: { productId: id },
        orderBy: { sortOrder: "asc" },
      });

      await tx.product.update({
        where: { id },
        data: {
          colors: JSON.stringify(allColors.map((c) => ({ name: c.name, hex: c.hex }))),
        },
      });

      return updated;
    });

    return NextResponse.json(updatedColor);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update product color" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; colorId: string }> }
) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const { id, colorId } = await params;

  try {
    const count = await prisma.productColor.count({
      where: { productId: id },
    });

    if (count <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the last color. Every product must have at least one color." },
        { status: 400 }
      );
    }

    const existingColor = await prisma.productColor.findUnique({
      where: { id: colorId },
    });

    if (!existingColor || existingColor.productId !== id) {
      return NextResponse.json({ error: "Color not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete all StockLevel rows for this color
      await tx.stockLevel.deleteMany({
        where: { productId: id, color: existingColor.name },
      });

      // 2. Delete ProductColor
      await tx.productColor.delete({
        where: { id: colorId },
      });

      // 3. Update Product.colors JSON
      const remainingColors = await tx.productColor.findMany({
        where: { productId: id },
        orderBy: { sortOrder: "asc" },
      });

      await tx.product.update({
        where: { id },
        data: {
          colors: JSON.stringify(remainingColors.map((c) => ({ name: c.name, hex: c.hex }))),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to delete product color" },
      { status: 500 }
    );
  }
}
