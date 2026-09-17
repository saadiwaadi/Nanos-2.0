import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { getAdminCourierQueue } from "@/lib/postex";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  try {
    const queueData = await getAdminCourierQueue();
    return NextResponse.json(queueData);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch courier queue" },
      { status: 500 }
    );
  }
}
