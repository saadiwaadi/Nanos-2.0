import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { memoryOrders } from "@/app/api/orders/route";
import { reserveStock } from "@/lib/stock";
import { AppError } from "@/lib/order-state";

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

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const adminEmail = (auth as { userId?: string }).userId || "admin";

  try {
    const body = await request.json();
    const {
      customerName,
      phone,
      email,
      address,
      city,
      notes,
      adminNote,
      payment = "cod",
      orderStatus = "READY_TO_SHIP",
      shippingFee = 0,
      discount = 0,
      reserveInventory = true,
      isTest = false,
      items,
    } = body || {};

    if (!customerName || !customerName.trim()) {
      return NextResponse.json(
        { error: "Customer name is required." },
        { status: 400 }
      );
    }

    if (!phone || !phone.trim()) {
      return NextResponse.json(
        { error: "Customer phone number is required." },
        { status: 400 }
      );
    }

    if (!address || !address.trim()) {
      return NextResponse.json(
        { error: "Delivery address is required." },
        { status: 400 }
      );
    }

    if (!city || !city.trim()) {
      return NextResponse.json(
        { error: "City is required." },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "At least one order item is required." },
        { status: 400 }
      );
    }

    // Resolve products & calculate subtotal
    const resolvedItems: Array<{
      productId: string;
      sku: string;
      name: string;
      color: string;
      size: string;
      quantity: number;
      unitPrice: number;
      hero?: string;
    }> = [];

    let subtotal = 0;

    for (const it of items) {
      if (!it.productId) {
        return NextResponse.json(
          { error: "Product ID is missing on an order line item." },
          { status: 400 }
        );
      }

      let prod: any = null;
      try {
        prod = await prisma.product.findUnique({
          where: { id: it.productId },
        });
      } catch {
        // Fallback for dev/memory mode
      }

      const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
      const unitPrice =
        it.unitPrice !== undefined && it.unitPrice !== null && !isNaN(Number(it.unitPrice))
          ? Math.max(0, Math.round(Number(it.unitPrice)))
          : prod?.price ?? 0;

      subtotal += unitPrice * qty;

      resolvedItems.push({
        productId: it.productId,
        sku: prod?.sku || `SKU-${it.productId.toUpperCase()}`,
        name: prod?.name || it.name || "Nanos Item",
        color: it.color || "Standard",
        size: it.size || "Standard",
        quantity: qty,
        unitPrice,
        hero: prod?.hero || it.hero || "",
      });
    }

    const finalShipping = Math.max(0, Math.round(Number(shippingFee) || 0));
    const finalDiscount = Math.max(0, Math.round(Number(discount) || 0));
    const total = Math.max(0, subtotal - finalDiscount) + finalShipping;

    const shippingInfoObj = {
      name: customerName.trim(),
      phone: phone.trim(),
      email: (email || "").trim(),
      address: address.trim(),
      city: city.trim(),
      notes: (notes || "").trim(),
      adminNote: (adminNote || "").trim(),
    };

    const orderId = "ord_" + Math.random().toString(36).substring(2, 11);
    const initialStatus = orderStatus === "ON_HOLD" ? "on_hold" : "placed";
    const courierBookingStatus = "queued";

    const stockLines = resolvedItems.map((i) => ({
      productId: i.productId,
      color: i.color,
      size: i.size,
      qty: i.quantity,
    }));

    try {
      const createdOrder = await prisma.$transaction(
        async (tx) => {
          let trackedMap: Record<string, boolean> = {};
          if (reserveInventory) {
            trackedMap = await reserveStock(tx, stockLines);
          }

          const ord = await tx.order.create({
            data: {
              id: orderId,
              customerName: customerName.trim(),
              customerEmail: (email || "").trim() || null,
              guestName: customerName.trim(),
              guestEmail: (email || "").trim() || null,
              subtotal,
              discount: finalDiscount,
              shipping: finalShipping,
              total,
              shippingInfo: JSON.stringify(shippingInfoObj),
              notes: (notes || "").trim() || null,
              payment: payment || "cod",
              orderStatus: orderStatus || "READY_TO_SHIP",
              status: initialStatus,
              courierBookingStatus,
              stockReserved: reserveInventory,
              isTest: Boolean(isTest),
              items: {
                create: resolvedItems.map((i) => {
                  const key = `${i.productId}:${i.color}:${i.size}`;
                  return {
                    productId: i.productId,
                    sku: i.sku,
                    name: i.name,
                    color: i.color,
                    size: i.size,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                    stockTracked: trackedMap[key] ?? false,
                  };
                }),
              },
            },
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

          await tx.orderEvent.create({
            data: {
              orderId: ord.id,
              type: "created",
              toValue: orderStatus || "READY_TO_SHIP",
              actor: `admin:${adminEmail}`,
            },
          });

          await tx.orderAuditLog.create({
            data: {
              orderId: ord.id,
              action: "CREATED_BY_ADMIN",
              adminUser: adminEmail,
              note: `Order manually created via Admin Panel (${resolvedItems.length} items, Total: PKR ${total.toLocaleString()})`,
            },
          });

          if (adminNote && adminNote.trim()) {
            await tx.orderAuditLog.create({
              data: {
                orderId: ord.id,
                action: "ADMIN_NOTE",
                adminUser: adminEmail,
                note: `Admin note: ${adminNote.trim()}`,
              },
            });
          }

          return ord;
        },
        { maxWait: 10000, timeout: 25000 }
      );

      return NextResponse.json({
        success: true,
        order: {
          id: createdOrder.id,
          orderStatus: (createdOrder as any).orderStatus || orderStatus,
          status: createdOrder.status,
          courierBookingStatus: createdOrder.courierBookingStatus,
          courierStatusRaw: createdOrder.courierStatusRaw,
          trackingNumber: createdOrder.trackingNumber,
          postexTrackingNumber: createdOrder.postexTrackingNumber,
          subtotal: createdOrder.subtotal,
          discount: createdOrder.discount,
          shipping: createdOrder.shipping,
          total: createdOrder.total,
          shippingInfo: createdOrder.shippingInfo,
          notes: createdOrder.notes,
          payment: createdOrder.payment,
          guestEmail: createdOrder.guestEmail,
          guestName: createdOrder.guestName,
          customerName: createdOrder.customerName,
          customerEmail: createdOrder.customerEmail,
          createdAt: createdOrder.createdAt,
          version: createdOrder.version,
          isTest: createdOrder.isTest,
          user: createdOrder.user,
          orderItems: createdOrder.items.map((i) => ({
            id: i.id,
            productId: i.productId,
            quantity: i.quantity,
            price: i.unitPrice,
            size: i.size,
            color: i.color,
            product: i.product || {
              id: i.productId,
              name: i.name,
              hero: "",
            },
          })),
          auditLogs: (createdOrder as any).auditLogs || [],
        },
      });
    } catch (txErr: any) {
      if (txErr instanceof AppError && txErr.code === "OUT_OF_STOCK") {
        return NextResponse.json(
          {
            error: "OUT_OF_STOCK",
            message: txErr.message || "Selected item variants are out of stock.",
            shortages: txErr.details?.shortages || [],
          },
          { status: 409 }
        );
      }
      throw txErr;
    }
  } catch (err: any) {
    console.error("Admin create order error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create order" },
      { status: 500 }
    );
  }
}
