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
    const colors = await prisma.productColor.findMany({
      where: { productId: id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(colors);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch product colors" },
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
    const { name, hex, images = [], sortOrder = 0 } = body;

    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) {
      return NextResponse.json(
        { error: "Color name is required and cannot be blank." },
        { status: 400 }
      );
    }

    const normalizedHex = normalizeHex(hex);
    if (!normalizedHex) {
      return NextResponse.json(
        { error: "Invalid hex code. Please provide a valid 6-character hex color (e.g. #111111)." },
        { status: 400 }
      );
    }

    // Check duplicate color name for this product
    const existing = await prisma.productColor.findFirst({
      where: {
        productId: id,
        name: { equals: trimmedName, mode: "insensitive" },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `A color named "${trimmedName}" already exists for this product.` },
        { status: 400 }
      );
    }

    // Get current product to read existing sizes
    const product = await prisma.product.findUnique({
      where: { id },
      include: { stockLevels: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    let sizesList: string[] = [];
    try {
      sizesList = JSON.parse(product.sizes || "[]");
    } catch {}
    if (!Array.isArray(sizesList) || sizesList.length === 0) {
      sizesList = Array.from(new Set(product.stockLevels.map((s) => s.size)));
    }
    if (sizesList.length === 0) {
      sizesList = ["Standard"];
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create ProductColor
      const color = await tx.productColor.create({
        data: {
          productId: id,
          name: trimmedName,
          hex: normalizedHex,
          imagesJson: JSON.stringify(Array.isArray(images) ? images : []),
          sortOrder: Number(sortOrder) || 0,
        },
      });

      // 2. Create StockLevel rows with stock 0 for every size
      for (const s of sizesList) {
        await tx.stockLevel.upsert({
          where: {
            productId_color_size: {
              productId: id,
              color: trimmedName,
              size: s,
            },
          },
          update: {},
          create: {
            productId: id,
            color: trimmedName,
            size: s,
            quantity: 0,
          },
        });
      }

      // 3. Update Product.colors JSON
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

      return color;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create product color" },
      { status: 500 }
    );
  }
}
