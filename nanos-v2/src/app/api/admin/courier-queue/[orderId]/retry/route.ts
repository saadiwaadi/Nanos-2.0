import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { bookOne } from "@/lib/postex-booking";
import { PostexError } from "@/lib/postex-client";
import { AppError } from "@/lib/order-state";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ orderId: string }> }
) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const { orderId } = await ctx.params;
  const adminEmail = (auth as { userId: string }).userId || "admin:manual";

  try {
    const res = await bookOne(orderId, adminEmail);

    let ok = false;
    let message = "";

    switch (res.result) {
      case "booked":
        ok = true;
        message = `Order booked successfully with PostEx (Tracking: ${res.tracking}).`;
        break;
      case "abort":
        ok = false;
        message = `Booking stopped: ${res.error}. The order stays queued.`;
        break;
      case "failed":
        ok = false;
        message = res.error || "Booking failed.";
        break;
      case "needs_review":
        ok = false;
        message = "Order needs review: City not serviceable by PostEx.";
        break;
      case "skipped":
        ok = false;
        message = "Order booking skipped or already in progress.";
        break;
      default:
        ok = false;
        message = "Unknown booking outcome.";
    }

    return NextResponse.json({
      ok,
      result: res.result,
      message,
      tracking: (res as any).tracking || null,
      error: (res as any).error || null,
    });
  } catch (err: any) {
    if (err instanceof PostexError || err instanceof AppError) {
      return NextResponse.json({
        ok: false,
        result: "failed",
        message: err.message,
      });
    }

    return NextResponse.json(
      { error: err.message || "Unexpected exception during retry booking" },
      { status: 500 }
    );
  }
}
