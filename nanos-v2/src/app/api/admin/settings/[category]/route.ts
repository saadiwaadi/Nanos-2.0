import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ category: string }> }
) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  try {
    const { category } = await params;
    const body = await request.json();
    const { lowStockThreshold } = body;

    if (
      typeof lowStockThreshold !== "number" ||
      !Number.isInteger(lowStockThreshold) ||
      lowStockThreshold < 0
    ) {
      return NextResponse.json(
        { error: "lowStockThreshold must be an integer >= 0" },
        { status: 400 }
      );
    }

    const decodedCategory = decodeURIComponent(category);

    const updated = await prisma.categorySettings.upsert({
      where: { category: decodedCategory },
      update: { lowStockThreshold },
      create: { category: decodedCategory, lowStockThreshold },
    });

    try {
      await prisma.categorySetting.upsert({
        where: { category: decodedCategory },
        update: { lowStockThreshold },
        create: { category: decodedCategory, lowStockThreshold },
      });
    } catch {
      // Ignore secondary upsert
    }

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update settings" },
      { status: 500 }
    );
  }
}
