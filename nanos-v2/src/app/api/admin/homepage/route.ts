import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { getHomePageConfig, saveHomePageConfig, HomePageConfig } from "@/lib/homepage";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  try {
    const config = await getHomePageConfig();
    return NextResponse.json({ config });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load homepage config" },
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
    const config = body.config as HomePageConfig;

    if (!config) {
      return NextResponse.json({ error: "Configuration object is required" }, { status: 400 });
    }

    const saved = await saveHomePageConfig(config);
    return NextResponse.json({ success: true, config: saved });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to save homepage config" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return PUT(request);
}
