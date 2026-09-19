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
    const rows = await prisma.categorySetting.findMany({
      orderBy: { category: "asc" },
    });

    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch category settings" },
      { status: 500 }
    );
  }
}
