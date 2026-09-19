import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { memoryOrders } from "@/app/api/orders/route";
import { callCancelOrderApi } from "@/lib/postex";

const VALID_STATUSES = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { status } = body || {};

    if (!status || !VALID_STATUSES.includes(String(status).toUpperCase())) {
      return NextResponse.json({ error: "Invalid status provided." }, { status: 400 });
    }

    const normStatus = String(status).toUpperCase();
    let warning: string | undefined = undefined;

    if (normStatus === "CANCELLED") {
      try {
        const existingOrder = await prisma.order.findUnique({
          where: { id },
          select: { id: true, postexTrackingNumber: true },
        });

        if (existingOrder?.postexTrackingNumber) {
          const trackingNumber = existingOrder.postexTrackingNumber;
          try {
            const cancelRes = await callCancelOrderApi(trackingNumber);
            const isSuccess =
              cancelRes &&
              (cancelRes.statusCode === "200" ||
                cancelRes.statusCode === "201" ||
                cancelRes.status === "200" ||
                cancelRes.success === true);

            const errMsg = isSuccess
              ? null
              : cancelRes?.statusMessage ||
                cancelRes?.message ||
                cancelRes?.error ||
                "PostEx cancel API returned non-200 status";

            await prisma.postexBookingLog.create({
              data: {
                orderId: id,
                requestPayload: JSON.stringify({ action: "cancelOrder", trackingNumber }),
                responsePayload: JSON.stringify(cancelRes || {}),
                success: Boolean(isSuccess),
                errorMessage: errMsg,
              },
            });

            if (!isSuccess) {
              warning = `Order status updated to CANCELLED, but PostEx courier cancellation failed: ${errMsg}`;
              console.warn(`[Order Cancel Warning] ${warning}`);
            }
          } catch (apiErr: any) {
            const errMsg = apiErr.message || "Failed to reach PostEx API for order cancellation";
            warning = `Order status updated to CANCELLED, but PostEx API call failed: ${errMsg}`;
            console.error(`[Order Cancel Error] ${warning}`);

            try {
              await prisma.postexBookingLog.create({
                data: {
                  orderId: id,
                  requestPayload: JSON.stringify({ action: "cancelOrder", trackingNumber }),
                  responsePayload: JSON.stringify({ error: errMsg }),
                  success: false,
                  errorMessage: errMsg,
                },
              });
            } catch {
              // Ignore logging error fallback
            }
          }
        }
      } catch (findErr) {
        console.error("Error looking up order before cancellation:", findErr);
      }
    }

    // Memory update
    if (memoryOrders.has(id)) {
      const existing = memoryOrders.get(id);
      memoryOrders.set(id, { ...existing, status: normStatus });
    }

    try {
      const updated = await prisma.order.update({
        where: { id },
        data: { status: normStatus },
      });
      return NextResponse.json({ order: updated, ...(warning ? { warning } : {}) });
    } catch {
      const memOrder = memoryOrders.get(id) || { id, status: normStatus };
      return NextResponse.json({ order: memOrder, ...(warning ? { warning } : {}) });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update order status" }, { status: 500 });
  }
}
