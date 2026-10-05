import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { transitionOrder } from "@/lib/order-state";
import { bookOne } from "@/lib/postex-booking";
import { callCancelOrderApi } from "@/lib/postex";
import { releaseStock } from "@/lib/stock";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const adminEmail = (auth as any).email || (auth as any).userId || "admin@nanos.pk";

  try {
    const body = await request.json().catch(() => ({}));
    const { ids, action, reason, note } = body || {};
    const logNote = note || reason || "";

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

    const normAction = String(action || "").toLowerCase().trim();
    const results: Array<{ id: string; ok: boolean; message?: string; error?: string }> = [];

    for (const id of ids) {
      try {
        const order = await prisma.order.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!order) {
          results.push({ id, ok: false, error: "Order not found" });
          continue;
        }

        // 1. BULK SEND TO POSTEX
        if (normAction === "send_postex" || normAction === "send") {
          const activeTracking = order.trackingNumber || order.postexTrackingNumber;
          if (activeTracking || order.orderStatus === "BOOKED" || order.courierBookingStatus === "booked") {
            results.push({ id, ok: false, error: `Already booked (${activeTracking || "Booked"})` });
            continue;
          }

          if (order.orderStatus === "ON_HOLD" || order.status === "on_hold") {
            results.push({ id, ok: false, error: "Order is on hold. Release hold first." });
            continue;
          }

          if (order.orderStatus === "CANCELLED" || order.status === "cancelled") {
            results.push({ id, ok: false, error: "Cannot send a cancelled order." });
            continue;
          }

          const res = await bookOne(id, adminEmail);
          if (res.result === "booked") {
            results.push({ id, ok: true, message: `Booked: ${res.tracking}` });
          } else if (res.result === "needs_review") {
            results.push({ id, ok: false, error: "City not serviceable or needs address review" });
          } else {
            results.push({ id, ok: false, error: (res as any).error || (res as any).reason || `Booking result: ${res.result}` });
          }
        }
        // 2. BULK PUT ON HOLD
        else if (normAction === "hold" || normAction === "on_hold") {
          if (order.orderStatus === "CANCELLED" || order.status === "cancelled") {
            results.push({ id, ok: false, error: "Cannot hold a cancelled order" });
            continue;
          }

          await prisma.$transaction(
            async (tx) => {
              await tx.order.update({
                where: { id },
                data: {
                  orderStatus: "ON_HOLD",
                  status: "on_hold",
                  version: { increment: 1 },
                },
              });

              await tx.orderAuditLog.create({
                data: {
                  orderId: id,
                  action: "HOLD",
                  adminUser: adminEmail,
                  note: logNote || "Bulk put on hold by admin",
                },
              });

              await tx.orderEvent.create({
                data: {
                  orderId: id,
                  type: "status_change",
                  fromValue: order.orderStatus,
                  toValue: "ON_HOLD",
                  actor: adminEmail,
                  reason: logNote || "Bulk action: hold",
                },
              });
            },
            { maxWait: 10000, timeout: 25000 }
          );

          results.push({ id, ok: true });
        }
        // 3. BULK RELEASE HOLD
        else if (normAction === "release" || normAction === "release_hold") {
          await prisma.$transaction(
            async (tx) => {
              const nextStatus = (order.trackingNumber || order.postexTrackingNumber) ? "BOOKED" : "READY_TO_SHIP";
              await tx.order.update({
                where: { id },
                data: {
                  orderStatus: nextStatus,
                  status: "confirmed",
                  version: { increment: 1 },
                },
              });

              await tx.orderAuditLog.create({
                data: {
                  orderId: id,
                  action: "RELEASE",
                  adminUser: adminEmail,
                  note: logNote || "Bulk release hold by admin",
                },
              });

              await tx.orderEvent.create({
                data: {
                  orderId: id,
                  type: "status_change",
                  fromValue: "ON_HOLD",
                  toValue: nextStatus,
                  actor: adminEmail,
                  reason: logNote || "Bulk action: release",
                },
              });
            },
            { maxWait: 10000, timeout: 25000 }
          );

          results.push({ id, ok: true });
        }
        // 4. BULK CANCEL
        else if (normAction === "cancel") {
          const activeTracking = order.trackingNumber || order.postexTrackingNumber;

          if (activeTracking) {
            try {
              const postexRes: any = await callCancelOrderApi(activeTracking);
              const isSuccess = postexRes?.statusCode === "200" || postexRes?.dist?.orderStatus === "Cancelled";
              if (!isSuccess) {
                const msg = postexRes?.statusMessage || postexRes?.message || "PostEx refused cancellation.";
                results.push({ id, ok: false, error: `PostEx cancel failed: ${msg}` });
                continue;
              }
            } catch (pErr: any) {
              results.push({ id, ok: false, error: `PostEx API error: ${pErr.message}` });
              continue;
            }
          }

          await prisma.$transaction(
            async (tx) => {
              if (order.stockReserved) {
                await releaseStock(tx, order.items);
              }

              await tx.order.update({
                where: { id },
                data: {
                  orderStatus: "CANCELLED",
                  status: "cancelled",
                  courierBookingStatus: activeTracking ? "cancelled" : "not_booked",
                  courierStatusRaw: activeTracking ? "Cancelled" : order.courierStatusRaw,
                  stockReserved: false,
                  version: { increment: 1 },
                },
              });

              await tx.orderAuditLog.create({
                data: {
                  orderId: id,
                  action: "CANCEL",
                  adminUser: adminEmail,
                  note: logNote || (activeTracking ? `Bulk cancelled with PostEx (${activeTracking})` : "Bulk cancelled by admin"),
                },
              });

              await tx.orderEvent.create({
                data: {
                  orderId: id,
                  type: "status_change",
                  fromValue: order.orderStatus,
                  toValue: "CANCELLED",
                  actor: adminEmail,
                  reason: logNote || "Bulk action: cancel",
                },
              });
            },
            { maxWait: 10000, timeout: 25000 }
          );

          results.push({ id, ok: true });
        }
        // Backward compatible legacy actions
        else if (normAction === "confirm") {
          await transitionOrder(prisma, {
            orderId: id,
            to: "confirmed",
            actor: adminEmail,
            reason: logNote,
          });
          results.push({ id, ok: true });
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
