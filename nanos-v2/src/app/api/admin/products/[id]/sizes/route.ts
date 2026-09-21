import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

function parseSizes(sizesJson: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(sizesJson || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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
      include: { stockLevels: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    let sizes = parseSizes(product.sizes);
    if (sizes.length === 0) {
      sizes = Array.from(new Set(product.stockLevels.map((s) => s.size)));
    }

    return NextResponse.json({ sizes });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch sizes" },
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
    const size = typeof body.size === "string" ? body.size.trim() : "";

    if (!size) {
      return NextResponse.json(
        { error: "Size name is required and cannot be blank." },
        { status: 400 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: { productColors: true, stockLevels: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const currentSizes = parseSizes(product.sizes);
    const existingCaseInsensitive = currentSizes.find(
      (s) => s.toLowerCase() === size.toLowerCase()
    );

    if (existingCaseInsensitive) {
      return NextResponse.json(
        { error: `Size "${size}" already exists for this product.` },
        { status: 400 }
      );
    }

    // Colors to create variants for
    let colors = product.productColors.map((c) => c.name);
    if (colors.length === 0) {
      colors = Array.from(new Set(product.stockLevels.map((s) => s.color)));
    }
    if (colors.length === 0) {
      colors = ["Standard"];
    }

    const updatedSizes = [...currentSizes, size];

    await prisma.$transaction(async (tx) => {
      // 1. Create StockLevel rows with stock 0 for every color
      for (const colorName of colors) {
        await tx.stockLevel.upsert({
          where: {
            productId_color_size: {
              productId: id,
              color: colorName,
              size,
            },
          },
          update: {},
          create: {
            productId: id,
            color: colorName,
            size,
            quantity: 0,
          },
        });
      }

      // 2. Update Product.sizes JSON
      await tx.product.update({
        where: { id },
        data: { sizes: JSON.stringify(updatedSizes) },
      });
    });

    return NextResponse.json(
      { success: true, sizes: updatedSizes, addedSize: size },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to add size" },
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

    // Mode A: Reorder sizes
    if (Array.isArray(body.sizes)) {
      const newSizes = body.sizes
        .map((s: any) => (typeof s === "string" ? s.trim() : ""))
        .filter(Boolean);

      await prisma.product.update({
        where: { id },
        data: { sizes: JSON.stringify(newSizes) },
      });

      return NextResponse.json({ success: true, sizes: newSizes });
    }

    // Mode B: Rename a size
    const oldSize = typeof body.oldSize === "string" ? body.oldSize.trim() : "";
    const newSize = typeof body.newSize === "string" ? body.newSize.trim() : "";

    if (!oldSize || !newSize) {
      return NextResponse.json(
        { error: "Both oldSize and newSize are required." },
        { status: 400 }
      );
    }

    if (oldSize === newSize) {
      return NextResponse.json({ success: true });
    }

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const currentSizes = parseSizes(product.sizes);
    const hasDuplicate = currentSizes.some(
      (s) => s.toLowerCase() === newSize.toLowerCase() && s.toLowerCase() !== oldSize.toLowerCase()
    );

    if (hasDuplicate) {
      return NextResponse.json(
        { error: `Size "${newSize}" already exists.` },
        { status: 400 }
      );
    }

    const updatedSizes = currentSizes.map((s) => (s === oldSize ? newSize : s));
    if (!currentSizes.includes(oldSize)) {
      updatedSizes.push(newSize);
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update all StockLevel rows
      await tx.stockLevel.updateMany({
        where: { productId: id, size: oldSize },
        data: { size: newSize },
      });

      // 2. Update Product.sizes JSON
      await tx.product.update({
        where: { id },
        data: { sizes: JSON.stringify(updatedSizes) },
      });
    });

    return NextResponse.json({ success: true, sizes: updatedSizes });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update sizes" },
      { status: 500 }
    );
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

  try {
    const body = await request.json().catch(() => ({}));
    const url = new URL(request.url);
    const sizeParam = url.searchParams.get("size") || body.size;
    const targetSize = typeof sizeParam === "string" ? sizeParam.trim() : "";

    if (!targetSize) {
      return NextResponse.json(
        { error: "Size to delete is required." },
        { status: 400 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const currentSizes = parseSizes(product.sizes);
    const remainingSizes = currentSizes.filter((s) => s !== targetSize);

    await prisma.$transaction(async (tx) => {
      // 1. Delete all StockLevel rows for this size
      await tx.stockLevel.deleteMany({
        where: { productId: id, size: targetSize },
      });

      // 2. Update Product.sizes JSON
      await tx.product.update({
        where: { id },
        data: { sizes: JSON.stringify(remainingSizes) },
      });
    });

    return NextResponse.json({ success: true, sizes: remainingSizes });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to delete size" },
      { status: 500 }
    );
  }
}
