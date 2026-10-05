import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { bookOne } from "@/lib/postex-booking";
import { callCancelOrderApi } from "@/lib/postex";
import { releaseStock, reserveStock } from "@/lib/stock";

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
  const adminEmail = (auth as any).email || (auth as any).userId || "admin@nanos.pk";

  try {
    const body = await request.json().catch(() => ({}));
    const { action, note, reason } = body || {};
    const logNote = note || reason || "";

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const normAction = String(action || "").toUpperCase().trim();

    // ─── 1. SEND TO POSTEX ──────────────────────────────────
    if (normAction === "SEND_POSTEX" || normAction === "SEND") {
      const activeTracking = order.trackingNumber || order.postexTrackingNumber;
      if (activeTracking || order.orderStatus === "BOOKED" || order.courierBookingStatus === "booked") {
        return NextResponse.json(
          { error: `Order already has active tracking number (${activeTracking || "Booked"}). Duplicate booking prevented.` },
          { status: 400 }
        );
      }

      if (order.orderStatus === "ON_HOLD" || order.status === "on_hold") {
        return NextResponse.json(
          { error: "Order is On Hold. Please release the hold before sending to PostEx." },
          { status: 400 }
        );
      }

      if (order.orderStatus === "CANCELLED" || order.status === "cancelled") {
        return NextResponse.json(
          { error: "Cannot send a cancelled order to PostEx." },
          { status: 400 }
        );
      }

      const result = await bookOne(order.id, adminEmail);
      if (result.result === "booked") {
        const updated = await prisma.order.findUnique({
          where: { id },
          include: { auditLogs: { orderBy: { createdAt: "desc" } } },
        });
        return NextResponse.json({ ok: true, message: `Successfully booked with PostEx! Tracking: ${result.tracking}`, order: updated });
      } else if (result.result === "needs_review") {
        return NextResponse.json(
          { error: "City not serviceable by PostEx or needs address review." },
          { status: 400 }
        );
      } else if (result.result === "skipped") {
        return NextResponse.json(
          { error: (result as any).reason || "Order cannot be booked (already in progress, booked, or on hold)." },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          { error: (result as any).error || "Failed to book order with PostEx." },
          { status: 400 }
        );
      }
    }

    // ─── 2. PUT ON HOLD ─────────────────────────────────────
    if (normAction === "HOLD" || normAction === "ON_HOLD") {
      if (order.orderStatus === "CANCELLED" || order.status === "cancelled") {
        return NextResponse.json({ error: "Cannot put a cancelled order on hold." }, { status: 400 });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const o = await tx.order.update({
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
            note: logNote || "Order put on hold by admin",
          },
        });

        await tx.orderEvent.create({
          data: {
            orderId: id,
            type: "status_change",
            fromValue: order.orderStatus,
            toValue: "ON_HOLD",
            actor: adminEmail,
            reason: logNote || undefined,
          },
        });

        return o;
      });

      return NextResponse.json({ ok: true, message: "Order placed on hold.", order: updated });
    }

    // ─── 3. RELEASE HOLD ────────────────────────────────────
    if (normAction === "RELEASE" || normAction === "RELEASE_HOLD") {
      const updated = await prisma.$transaction(async (tx) => {
        const nextStatus = (order.trackingNumber || order.postexTrackingNumber) ? "BOOKED" : "READY_TO_SHIP";
        const o = await tx.order.update({
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
            note: logNote || "Hold released by admin",
          },
        });

        await tx.orderEvent.create({
          data: {
            orderId: id,
            type: "status_change",
            fromValue: "ON_HOLD",
            toValue: nextStatus,
            actor: adminEmail,
            reason: logNote || undefined,
          },
        });

        return o;
      });

      return NextResponse.json({ ok: true, message: "Hold released. Order is now ready.", order: updated });
    }

    // ─── 4. CANCEL ORDER ────────────────────────────────────
    if (normAction === "CANCEL") {
      const activeTracking = order.trackingNumber || order.postexTrackingNumber;

      if (activeTracking) {
        // Booked with PostEx: Attempt cancellation via PostEx API first
        try {
          const postexRes: any = await callCancelOrderApi(activeTracking);
          const isSuccess = postexRes?.statusCode === "200" || postexRes?.dist?.orderStatus === "Cancelled";

          if (!isSuccess) {
            const msg = postexRes?.statusMessage || postexRes?.message || "PostEx refused cancellation (parcel may already be picked up).";
            return NextResponse.json(
              { error: `PostEx cancellation failed: ${msg}` },
              { status: 400 }
            );
          }
        } catch (postexErr: any) {
          return NextResponse.json(
            { error: `PostEx cancel API error: ${postexErr.message || "Failed to contact PostEx"}` },
            { status: 400 }
          );
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (order.stockReserved) {
          await releaseStock(tx, order.items);
        }

        const o = await tx.order.update({
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
            note: logNote || (activeTracking ? `Cancelled with PostEx (${activeTracking})` : "Cancelled by admin"),
          },
        });

        await tx.orderEvent.create({
          data: {
            orderId: id,
            type: "status_change",
            fromValue: order.orderStatus,
            toValue: "CANCELLED",
            actor: adminEmail,
            reason: logNote || undefined,
          },
        });

        return o;
      });

      return NextResponse.json({ ok: true, message: "Order cancelled successfully.", order: updated });
    }

    // ─── 5. RESEND / RESTORE CANCELLED ORDER ────────────────
    if (normAction === "RESEND" || normAction === "RESTORE" || normAction === "REOPEN") {
      const updated = await prisma.$transaction(async (tx) => {
        // Re-reserve stock if items are present
        if (order.items && order.items.length > 0) {
          const linesToReserve = order.items.map((i) => ({
            productId: i.productId,
            color: i.color,
            size: i.size,
            qty: i.quantity,
          }));
          await reserveStock(tx, linesToReserve);
        }

        const o = await tx.order.update({
          where: { id },
          data: {
            orderStatus: "READY_TO_SHIP",
            status: "placed",
            courierBookingStatus: "not_booked",
            trackingNumber: null,
            postexTrackingNumber: null,
            courierStatusRaw: null,
            bookingError: null,
            bookingAttempts: 0,
            bookingLockedAt: null,
            bookingAmbiguous: false,
            stockReserved: true,
            version: { increment: 1 },
          },
        });

        await tx.orderAuditLog.create({
          data: {
            orderId: id,
            action: "RESEND",
            adminUser: adminEmail,
            note: logNote || "Cancelled order restored & queued for re-dispatch by admin",
          },
        });

        await tx.orderEvent.create({
          data: {
            orderId: id,
            type: "status_change",
            fromValue: order.orderStatus || "CANCELLED",
            toValue: "READY_TO_SHIP",
            actor: adminEmail,
            reason: logNote || "Order restored for re-dispatch",
          },
        });

        return o;
      });

      return NextResponse.json({ ok: true, message: "Order restored to Ready to Ship queue.", order: updated });
    }

    return NextResponse.json({ error: `Unknown lifecycle action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error("[lifecycle error]", err);
    return NextResponse.json(
      { error: err.message || "Failed to process lifecycle action" },
      { status: 500 }
    );
  }
}
