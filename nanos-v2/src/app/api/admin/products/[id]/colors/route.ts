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

    if (!name || !hex) {
      return NextResponse.json(
        { error: "name and hex are required" },
        { status: 400 }
      );
    }

    const color = await prisma.productColor.create({
      data: {
        productId: id,
        name,
        hex,
        imagesJson: JSON.stringify(Array.isArray(images) ? images : []),
        sortOrder: Number(sortOrder) || 0,
      },
    });

    return NextResponse.json(color);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create product color" },
      { status: 500 }
    );
  }
}
