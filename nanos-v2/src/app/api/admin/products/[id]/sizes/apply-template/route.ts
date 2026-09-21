import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

const DEFAULT_TEMPLATES: Record<string, string[]> = {
  crocs: ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10", "UK 11"],
  trousers: ["28", "30", "32", "34", "36", "38"],
};

function parseSizes(sizesJson: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(sizesJson || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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
    const product = await prisma.product.findUnique({
      where: { id },
      include: { productColors: true, stockLevels: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 1. Fetch category template from SizeChart table
    let templateSizes: string[] = [];
    const chart = await prisma.sizeChart.findUnique({
      where: { category: product.category },
    });

    if (chart && chart.rows) {
      try {
        const parsed = JSON.parse(chart.rows);
        if (Array.isArray(parsed)) {
          templateSizes = parsed.map((item: any) => {
            if (typeof item === "string") return item.trim();
            if (item && typeof item.size === "string") return item.size.trim();
            return "";
          }).filter(Boolean);
        }
      } catch {}
    }

    if (templateSizes.length === 0) {
      templateSizes = DEFAULT_TEMPLATES[product.category] || ["Standard"];
    }

    // 2. Identify missing sizes (never overwrite or delete existing ones)
    const currentSizes = parseSizes(product.sizes);
    const missingSizes = templateSizes.filter(
      (ts) => !currentSizes.some((cs) => cs.toLowerCase() === ts.toLowerCase())
    );

    if (missingSizes.length === 0) {
      return NextResponse.json({
        message: "Product already has all template sizes.",
        addedSizes: [],
        sizes: currentSizes,
      });
    }

    // 3. Colors to create variant stock rows for
    let colors = product.productColors.map((c) => c.name);
    if (colors.length === 0) {
      colors = Array.from(new Set(product.stockLevels.map((s) => s.color)));
    }
    if (colors.length === 0) {
      colors = ["Standard"];
    }

    const updatedSizes = [...currentSizes, ...missingSizes];

    await prisma.$transaction(async (tx) => {
      // Create StockLevel rows with stock 0 for missing sizes
      for (const newSize of missingSizes) {
        for (const colorName of colors) {
          await tx.stockLevel.upsert({
            where: {
              productId_color_size: {
                productId: id,
                color: colorName,
                size: newSize,
              },
            },
            update: {},
            create: {
              productId: id,
              color: colorName,
              size: newSize,
              quantity: 0,
            },
          });
        }
      }

      // Update Product.sizes JSON
      await tx.product.update({
        where: { id },
        data: { sizes: JSON.stringify(updatedSizes) },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Added ${missingSizes.length} missing sizes from category template.`,
      addedSizes: missingSizes,
      sizes: updatedSizes,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to apply size template" },
      { status: 500 }
    );
  }
}
