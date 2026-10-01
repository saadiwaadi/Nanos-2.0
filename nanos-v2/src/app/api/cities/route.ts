import { NextResponse } from "next/server";
import { getOperationalCities } from "@/lib/operational-cities";

export async function GET() {
  try {
    const cities = await getOperationalCities();
    return NextResponse.json(
      { cities },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=43200",
        },
      }
    );
  } catch (error: any) {
    console.error("GET /api/cities error:", error);
    return NextResponse.json(
      { error: "Failed to load operational cities" },
      { status: 500 }
    );
  }
}
