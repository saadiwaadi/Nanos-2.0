import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/order-state";
import { releaseStock, reserveStock } from "@/lib/stock";
import { resolveCity } from "@/lib/postex-booking";

export async function PATCH(
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
    const body = await request.json();
    const {
      expectedVersion,
      customerName,
      phone,
      email,
      address,
      city,
      notes,
      adminNote,
      shippingFee,
      isTest,
      payment,
      items,
    } = body || {};

    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: { include: { product: true } } },
      });

      if (!order) throw new AppError("NOT_FOUND", "Order not found", 404);

      if (
        expectedVersion !== undefined &&
        expectedVersion !== null &&
        order.version !== expectedVersion
      ) {
        throw new AppError(
          "VERSION_CONFLICT",
          "Order has been modified by another request. Please refresh.",
          409
        );
      }

      const isCancelled =
        order.status === "cancelled" || order.orderStatus === "CANCELLED";

      const isActivelyBooked =
        !isCancelled &&
        (order.courierBookingStatus === "booked" ||
          ["shipped", "delivered"].includes(order.status));

      const editingNonNotes =
        customerName !== undefined ||
        phone !== undefined ||
        email !== undefined ||
        address !== undefined ||
        city !== undefined ||
        shippingFee !== undefined ||
        items !== undefined;

      if (isActivelyBooked && editingNonNotes) {
        throw new AppError(
          "LOCKED",
          "This order is actively booked with PostEx. Cancel the booking to edit it.",
          409
        );
      }

      const sInfo =
        typeof order.shippingInfo === "string"
          ? JSON.parse(order.shippingInfo || "{}")
          : order.shippingInfo || {};

      const newSInfo = {
        ...sInfo,
        name: customerName ?? sInfo.name,
        phone: phone ?? sInfo.phone,
        email: email ?? sInfo.email,
        address: address ?? sInfo.address,
        city: city ?? sInfo.city,
        adminNote:
          adminNote !== undefined
            ? (typeof adminNote === "string" ? adminNote.trim() : "")
            : sInfo.adminNote,
      };

      let newSubtotal = order.subtotal;
      let newShipping = shippingFee !== undefined ? Number(shippingFee) : order.shipping;
      let newDiscount = order.discount;

      const diff: Record<string, any> = {};

      if (notes !== undefined && notes !== order.notes) {
        diff.notes = { before: order.notes, after: notes };
      }
      if (adminNote !== undefined && adminNote !== (sInfo.adminNote || "")) {
        diff.adminNote = { before: sInfo.adminNote || "", after: adminNote };
        await tx.orderAuditLog.create({
          data: {
            orderId: id,
            action: "ADMIN_NOTE",
            adminUser: adminEmail,
            note: adminNote ? `Admin note: ${adminNote}` : "Admin note cleared",
          },
        });
      }
      if (payment !== undefined && payment !== order.payment) {
        diff.payment = { before: order.payment, after: payment };
      }
      if (isTest !== undefined && isTest !== order.isTest) {
        diff.isTest = { before: order.isTest, after: isTest };
      }

      // Handle Item Changes
      if (items && Array.isArray(items)) {
        diff.items = { before: order.items, after: items };

        // 1. Release old stock
        if (order.stockReserved) {
          await releaseStock(tx, order.items);
        }

        // 2. Reserve new stock & resolve prices
        const resolvedLines: any[] = [];
        const stockLinesToReserve: any[] = [];
        let calculatedSubtotal = 0;

        for (const item of items) {
          const prod = await tx.product.findUnique({
            where: { id: item.productId },
          });
          if (!prod) {
            throw new AppError(
              "NOT_FOUND",
              `Product ${item.productId} not found for edit`,
              404
            );
          }

          const qty = Math.max(1, parseInt(item.qty, 10) || 1);
          // Preserve original unit price if unchanged item
          const existingItem = order.items.find(
            (i) => i.productId === item.productId && i.color === item.color && i.size === item.size
          );
          const unitPrice = existingItem ? existingItem.unitPrice : prod.price;

          calculatedSubtotal += unitPrice * qty;

          resolvedLines.push({
            productId: prod.id,
            sku: prod.sku,
            name: prod.name,
            color: item.color,
            size: item.size,
            quantity: qty,
            unitPrice,
          });

          stockLinesToReserve.push({
            productId: prod.id,
            color: item.color,
            size: item.size,
            qty,
          });
        }

        const trackedMap = await reserveStock(tx, stockLinesToReserve);

        // Delete old items & recreate
        await tx.orderItem.deleteMany({ where: { orderId: id } });

        await tx.orderItem.createMany({
          data: resolvedLines.map((i) => {
            const key = `${i.productId}:${i.color}:${i.size}`;
            return {
              orderId: id,
              productId: i.productId,
              sku: i.sku,
              name: i.name,
              color: i.color,
              size: i.size,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              stockTracked: trackedMap[key] ?? true,
            };
          }),
        });

        newSubtotal = calculatedSubtotal;
        newDiscount = Math.min(order.discount, newSubtotal);
      }

      const newTotal = newSubtotal - newDiscount + newShipping;

      // Handle City Change
      let newCourierBookingStatus = order.courierBookingStatus;
      let bookingError = order.bookingError;

      if (city !== undefined && city !== sInfo.city && order.courierBookingStatus === "queued") {
        const resolved = await resolveCity(city);
        if (!resolved) {
          newCourierBookingStatus = "awaiting_approval";
          bookingError = `City not serviceable by PostEx: "${city}"`;
        }
      }

      if (isCancelled && !order.stockReserved && (!items || items.length === 0)) {
        const linesToReserve = order.items.map((i) => ({
          productId: i.productId,
          color: i.color,
          size: i.size,
          qty: i.quantity,
        }));
        await reserveStock(tx, linesToReserve);
      }

      const r = await tx.order.updateMany({
        where: { id, version: order.version },
        data: {
          orderStatus: isCancelled ? "READY_TO_SHIP" : order.orderStatus,
          status: isCancelled ? "placed" : order.status,
          courierBookingStatus: isCancelled ? "not_booked" : newCourierBookingStatus,
          trackingNumber: isCancelled ? null : order.trackingNumber,
          postexTrackingNumber: isCancelled ? null : order.postexTrackingNumber,
          courierStatusRaw: isCancelled ? null : order.courierStatusRaw,
          stockReserved: isCancelled ? true : order.stockReserved,
          customerName: customerName ?? order.customerName,
          customerEmail: email ?? order.customerEmail,
          shippingInfo: JSON.stringify(newSInfo),
          notes: notes !== undefined ? notes : order.notes,
          payment: payment !== undefined ? payment : order.payment,
          isTest: isTest !== undefined ? isTest : order.isTest,
          subtotal: newSubtotal,
          discount: newDiscount,
          shipping: newShipping,
          total: newTotal,
          bookingError: isCancelled ? null : bookingError,
          version: { increment: 1 },
        },
      });

      if (isCancelled) {
        await tx.orderAuditLog.create({
          data: {
            orderId: id,
            action: "EDIT_RESEND",
            adminUser: adminEmail,
            note: "Cancelled order updated and restored to Ready to Ship queue",
          },
        });
      }

      if (r.count === 0) {
        throw new AppError(
          "STALE",
          "Order was modified by another request. Please reload.",
          409
        );
      }

      const updated = await tx.order.findUnique({
        where: { id },
        include: {
          items: { include: { product: true } },
          auditLogs: { orderBy: { createdAt: "desc" } },
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: id,
          type: "edited",
          actor: adminEmail,
          metadata: JSON.stringify(diff),
        },
      });

      return NextResponse.json({ ok: true, order: updated });
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "SERVER_ERROR", message: err.message || "Failed to update order" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    const body = await request.json();
    const { confirm } = body || {};

    return await prisma.$transaction(async (tx) => {
      const o = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!o) throw new AppError("NOT_FOUND", "Order not found", 404);

      const shortId = o.id.slice(-8);
      const isConfirmed =
        confirm === o.id || confirm === shortId || confirm === `#${shortId}`;

      if (!isConfirmed) {
        throw new AppError("CONFIRM_MISMATCH", "Type the order number to confirm.", 400);
      }

      if (!(o.status === "cancelled" || o.isTest)) {
        throw new AppError("NOT_DELETABLE", "Cancel the order first, then delete it.", 409);
      }

      if (["booked", "booking_in_progress"].includes(o.courierBookingStatus)) {
        throw new AppError("COURIER_ACTIVE", "Cancel the PostEx booking first.", 409);
      }

      if (o.stockReserved) {
        await releaseStock(tx, o.items);
      }

      await tx.postexBookingLog.deleteMany({ where: { orderId: id } });
      await tx.orderEvent.deleteMany({ where: { orderId: id } });
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.order.delete({ where: { id } });

      console.info("[admin-audit] order deleted", {
        orderId: o.id,
        by: adminEmail,
        at: new Date().toISOString(),
      });

      return NextResponse.json({ ok: true });
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "SERVER_ERROR", message: err.message || "Failed to delete order" },
      { status: 500 }
    );
  }
}
