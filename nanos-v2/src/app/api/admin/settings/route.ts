import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  try {
    let rows = await prisma.categorySettings.findMany({
      orderBy: { category: "asc" },
    });

    if (rows.length === 0) {
      try {
        const altRows = await prisma.categorySetting.findMany({
          orderBy: { category: "asc" },
        });
        if (altRows.length > 0) {
          rows = altRows;
        }
      } catch {
        // Ignore fallback error
      }
    }

    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch category settings" },
      { status: 500 }
    );
  }
}
