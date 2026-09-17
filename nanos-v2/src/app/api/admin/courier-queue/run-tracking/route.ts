import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { processBatchTracking } from "@/lib/postex";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  try {
    const results = await processBatchTracking();
    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to execute batch tracking" },
      { status: 500 }
    );
  }
}
