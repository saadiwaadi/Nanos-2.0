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
    const variants = await prisma.productVariant.findMany({
      where: { productId: id },
    });

    const grouped = variants.reduce((acc, v) => {
      if (!acc[v.color]) acc[v.color] = [];
      acc[v.color].push(v);
      return acc;
    }, {} as Record<string, typeof variants>);

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
    const { color, size, stock } = body;

    if (!color || !size || typeof stock !== "number") {
      return NextResponse.json(
        { error: "color, size, and stock (number) are required" },
        { status: 400 }
      );
    }

    const variant = await prisma.productVariant.upsert({
      where: {
        productId_color_size: {
          productId: id,
          color,
          size,
        },
      },
      update: { stock },
      create: {
        productId: id,
        color,
        size,
        stock,
      },
    });

    return NextResponse.json(variant);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to upsert variant" },
      { status: 500 }
    );
  }
}
