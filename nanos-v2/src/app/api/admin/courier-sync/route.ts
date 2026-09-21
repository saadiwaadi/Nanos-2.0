import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { syncCourierStatus } from "@/lib/courier-sync";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  try {
    const result = await syncCourierStatus();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Courier sync failed" },
      { status: 500 }
    );
  }
}
