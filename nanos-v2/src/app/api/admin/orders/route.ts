import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { memoryOrders } from "@/app/api/orders/route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  try {
    const dbOrders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, hero: true },
            },
          },
        },
        user: {
          select: { id: true, email: true, name: true },
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const orders = dbOrders.map((o) => {
      // Derive default orderStatus if not explicitly populated
      const fallbackStatus =
        o.status === "cancelled"
          ? "CANCELLED"
          : o.status === "on_hold"
          ? "ON_HOLD"
          : o.trackingNumber || o.postexTrackingNumber || o.courierBookingStatus === "booked"
          ? "BOOKED"
          : "READY_TO_SHIP";

      return {
        id: o.id,
        orderStatus: (o as any).orderStatus || fallbackStatus,
        status: o.status,
        courierBookingStatus: o.courierBookingStatus,
        courierStatusRaw: o.courierStatusRaw,
        trackingNumber: o.trackingNumber,
        postexTrackingNumber: o.postexTrackingNumber,
        subtotal: o.subtotal,
        discount: o.discount,
        shipping: o.shipping,
        total: o.total,
        shippingInfo: o.shippingInfo,
        notes: o.notes,
        payment: o.payment,
        guestEmail: o.guestEmail,
        guestName: o.guestName,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        createdAt: o.createdAt,
        version: o.version,
        isTest: o.isTest,
        user: o.user,
        orderItems: o.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          quantity: i.quantity,
          price: i.unitPrice,
          size: i.size,
          color: i.color,
          product: i.product || {
            id: i.productId,
            name: i.name || "Nanos Product",
            hero: "",
          },
        })),
        auditLogs: (o as any).auditLogs || [],
      };
    });

    return NextResponse.json({ orders });
  } catch {
    // Fallback to memoryOrders
    const memList = Array.from(memoryOrders.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const orders = memList.map((o) => ({
      id: o.id,
      orderStatus: o.orderStatus || (o.status === "CANCELLED" ? "CANCELLED" : o.status === "ON_HOLD" ? "ON_HOLD" : o.trackingNumber ? "BOOKED" : "READY_TO_SHIP"),
      status: o.status || "PENDING",
      courierBookingStatus: o.courierBookingStatus || "not_booked",
      courierStatusRaw: o.courierStatusRaw || null,
      trackingNumber: o.trackingNumber || null,
      postexTrackingNumber: o.postexTrackingNumber || null,
      subtotal: o.subtotal || 0,
      discount: o.discount || 0,
      shipping: o.shipping || 0,
      total: o.total || 0,
      shippingInfo: o.shippingInfo || "{}",
      notes: o.notes || null,
      payment: o.payment || "cod",
      guestEmail: o.guestEmail || null,
      guestName: o.guestName || null,
      customerName: o.customerName || null,
      customerEmail: o.customerEmail || null,
      createdAt: o.createdAt,
      version: o.version || 0,
      isTest: o.isTest || false,
      user: o.userId ? { id: o.userId, email: o.guestEmail || "user@nanos.pk", name: o.guestName || "Customer" } : null,
      orderItems: (o.items || []).map((i: any, idx: number) => ({
        id: `${o.id}_item_${idx}`,
        productId: i.productId,
        quantity: i.quantity || i.qty || 1,
        price: i.unitPrice || i.price || 0,
        size: i.size,
        color: i.color,
        product: {
          id: i.productId,
          name: i.name || "Nanos Product",
          hero: i.img || "",
        },
      })),
      auditLogs: o.auditLogs || [],
    }));

    return NextResponse.json({ orders });
  }
}
