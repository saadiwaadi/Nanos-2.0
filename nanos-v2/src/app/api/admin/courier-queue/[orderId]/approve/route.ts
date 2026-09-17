import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { approveManualOrder } from "@/lib/postex";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  try {
    const { orderId } = await params;
    const updated = await approveManualOrder(orderId);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to approve order" },
      { status: 500 }
    );
  }
}
