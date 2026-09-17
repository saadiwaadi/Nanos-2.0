import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function GET(
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
    const decodedCategory = decodeURIComponent(category);
    const chart = await prisma.sizeChart.findUnique({
      where: { category: decodedCategory },
    });

    if (!chart) {
      return NextResponse.json(null);
    }

    const rowsJson = (chart as any).rowsJson ?? (chart as any).rows ?? "[]";

    return NextResponse.json({
      ...chart,
      rowsJson,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch size chart" },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const decodedCategory = decodeURIComponent(category);
    const body = await request.json();
    const { rowsJson } = body;

    const chart = await prisma.sizeChart.upsert({
      where: { category: decodedCategory },
      update: { rows: rowsJson || "[]" },
      create: { category: decodedCategory, rows: rowsJson || "[]" },
    });

    return NextResponse.json(
      {
        ...chart,
        rowsJson: rowsJson || (chart as any).rows || "[]",
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update size chart" },
      { status: 500 }
    );
  }
}
