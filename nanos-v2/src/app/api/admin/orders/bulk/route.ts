import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { transitionOrder, AppError } from "@/lib/order-state";
import { bookOne } from "@/lib/postex-booking";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const adminEmail = (auth as { userId: string }).userId || "admin";

  try {
    const body = await request.json();
    const { ids, action, reason } = body || {};

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Order ids array is required." },
        { status: 400 }
      );
    }

    if (ids.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 order IDs allowed per bulk action." },
        { status: 400 }
      );
    }

    const results: Array<{ id: string; ok: boolean; error?: string }> = [];

    for (const id of ids) {
      try {
        if (action === "confirm") {
          await transitionOrder(prisma, {
            orderId: id,
            to: "confirmed",
            actor: adminEmail,
            reason,
          });
          results.push({ id, ok: true });
        } else if (action === "hold") {
          await transitionOrder(prisma, {
            orderId: id,
            to: "on_hold",
            actor: adminEmail,
            reason,
          });
          results.push({ id, ok: true });
        } else if (action === "cancel") {
          await transitionOrder(prisma, {
            orderId: id,
            to: "cancelled",
            actor: adminEmail,
            reason,
          });
          results.push({ id, ok: true });
        } else if (action === "queue_booking") {
          await prisma.order.update({
            where: { id },
            data: { courierBookingStatus: "queued" },
          });
          results.push({ id, ok: true });
        } else if (action === "retry_booking") {
          const res = await bookOne(id, "admin:bulk");
          if (res && res.result === "booked") {
            results.push({ id, ok: true });
          } else {
            results.push({ id, ok: false, error: (res as any)?.error || `Booking result: ${res?.result}` });
          }
        } else {
          results.push({ id, ok: false, error: `Unknown bulk action: ${action}` });
        }
      } catch (err: any) {
        results.push({ id, ok: false, error: err.message || "Bulk action failed" });
      }
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process bulk actions" },
      { status: 500 }
    );
  }
}
