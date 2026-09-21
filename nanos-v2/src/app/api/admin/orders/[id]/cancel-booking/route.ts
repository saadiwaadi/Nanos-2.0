import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { callCancelOrderApi } from "@/lib/postex";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const { id } = await ctx.params;
  const adminEmail = (auth as { userId: string }).userId || "admin";

  try {
    const order = await prisma.order.findUnique({ where: { id } });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!order.trackingNumber && !(order as any).postexTrackingNumber) {
      return NextResponse.json(
        { error: "Order does not have an active tracking number." },
        { status: 400 }
      );
    }

    const tracking = order.trackingNumber || (order as any).postexTrackingNumber;

    try {
      const postexRes: any = await callCancelOrderApi(tracking);

      if (postexRes?.statusCode === "200" || postexRes?.dist?.orderStatus === "Cancelled") {
        await prisma.order.update({
          where: { id },
          data: {
            courierBookingStatus: "cancelled",
            courierStatusRaw: "Cancelled",
          },
        });

        await prisma.orderEvent.create({
          data: {
            orderId: id,
            type: "booking_cancelled",
            toValue: "cancelled",
            actor: adminEmail,
            metadata: JSON.stringify({ tracking }),
          },
        });

        return NextResponse.json({ ok: true, message: "PostEx booking cancelled successfully." });
      } else {
        const msg = postexRes?.statusMessage || postexRes?.message || "PostEx refused cancellation.";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    } catch (e: any) {
      return NextResponse.json({ error: e.message || "PostEx API call failed" }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
