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
    const dbCities = await prisma.postexAutoBookCity.findMany({
      orderBy: { cityName: "asc" },
    });
    return NextResponse.json({
      defaultCities: ["Lahore", "Karachi", "Gujrat"],
      dbCities,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch cities" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  try {
    const body = await request.json();
    const { cityName, enabled } = body;
    if (!cityName || typeof cityName !== "string") {
      return NextResponse.json(
        { error: "cityName is required" },
        { status: 400 }
      );
    }

    const normalized = cityName.trim();
    const city = await prisma.postexAutoBookCity.upsert({
      where: { cityName: normalized },
      update: { enabled: Boolean(enabled) },
      create: { cityName: normalized, enabled: Boolean(enabled) },
    });

    return NextResponse.json(city);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update city" },
      { status: 500 }
    );
  }
}
