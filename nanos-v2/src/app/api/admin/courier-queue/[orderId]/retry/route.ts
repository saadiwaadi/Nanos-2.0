import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { retryOrderBooking } from "@/lib/postex";

export async function POST(
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
    let customPayload: any;
    try {
      customPayload = await request.json();
    } catch {
      // Body may be empty
    }

    const result = await retryOrderBooking(orderId, customPayload);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to retry booking" },
      { status: 500 }
    );
  }
}
