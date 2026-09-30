import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { runBatch } from "@/lib/postex-booking";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { includeAllUnbooked = true, limit = 200 } = body || {};
    const results = await runBatch({ includeAllUnbooked, limit });
    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to execute batch booking" },
      { status: 500 }
    );
  }
}
