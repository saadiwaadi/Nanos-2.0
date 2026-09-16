import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth-server";
import { getProductById } from "@/lib/products";
import { prisma } from "@/lib/prisma";

// In-memory fallback order store for dev when DB is offline
export const memoryOrders = new Map<string, any>();

export async function POST(request: Request) {
  try {
    const authPayload = await verifyToken(request);
    const userId = authPayload?.sub || null;

    const body = await request.json();
    const { items, shippingInfo, promoCode, guestEmail, guestName } = body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Cart items cannot be empty." } },
        { status: 400 }
      );
    }

    if (
      !shippingInfo ||
      !shippingInfo.name ||
      !shippingInfo.phone ||
      !shippingInfo.email ||
      !shippingInfo.address ||
      !shippingInfo.city ||
      !shippingInfo.postal
    ) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "All shipping details are required." } },
        { status: 400 }
      );
    }

    // Resolve each item's server-authoritative unit price and details
    let subtotal = 0;
    const resolvedItems = [];

    for (const item of items) {
      const product = await getProductById(item.productId);
      if (!product) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: `Product ${item.productId} not found.` } },
          { status: 404 }
        );
      }

      const qty = Math.max(1, parseInt(item.qty, 10) || 1);
      const unitPrice = product.price;
      subtotal += unitPrice * qty;

      resolvedItems.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        color: item.color || "Standard",
        size: item.size || "Standard",
        quantity: qty,
        unitPrice,
      });
    }

    const promoValid = promoCode === "NANOS10" && items.length > 0;
    const discount = promoValid ? Math.round(subtotal * 0.1) : 0;
    const afterDiscount = subtotal - discount;
    const shipping = afterDiscount >= 5000 ? 0 : 250;
    const total = afterDiscount + shipping;

    const orderId = "ord_" + Math.random().toString(36).substring(2, 11);
    const now = new Date().toISOString();

    const orderData = {
      id: orderId,
      userId,
      guestEmail: userId ? null : guestEmail || shippingInfo.email,
      guestName: userId ? null : guestName || shippingInfo.name,
      subtotal,
      discount,
      shipping,
      total,
      shippingInfo: JSON.stringify(shippingInfo),
      payment: "cod",
      status: "processing",
      createdAt: now,
      updatedAt: now,
      items: resolvedItems,
    };

    // Store in memory for instant retrieval fallback
    memoryOrders.set(orderId, orderData);

    // Try DB persistence if active
    try {
      await prisma.order.create({
        data: {
          id: orderId,
          userId,
          guestEmail: userId ? null : guestEmail || shippingInfo.email,
          guestName: userId ? null : guestName || shippingInfo.name,
          subtotal,
          discount,
          shipping,
          total,
          shippingInfo: JSON.stringify(shippingInfo),
          payment: "cod",
          status: "processing",
          items: {
            create: resolvedItems.map((i) => ({
              productId: i.productId,
              sku: i.sku,
              name: i.name,
              color: i.color,
              size: i.size,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
            })),
          },
        },
      });
    } catch {
      // Graceful fallback to memory store when DB offline
    }

    return NextResponse.json(
      {
        id: orderId,
        total,
        status: "processing",
        createdAt: now,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create order error:", error);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to place order." } },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const authPayload = await verifyToken(request);
    const userId = authPayload?.sub || null;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const dbOrders = await prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, hero: true },
              },
            },
          },
        },
      });

      const orders = dbOrders.map((o) => ({
        id: o.id,
        status: o.status,
        totalAmount: o.total,
        shippingFee: o.shipping,
        createdAt: o.createdAt,
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
      }));

      return NextResponse.json({ orders });
    } catch {
      // Fallback to memoryOrders if Prisma DB is offline
      const userMemoryOrders = Array.from(memoryOrders.values())
        .filter((o) => o.userId === userId)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      const orders = userMemoryOrders.map((o) => ({
        id: o.id,
        status: o.status || "PENDING",
        totalAmount: o.total,
        shippingFee: o.shipping,
        createdAt: o.createdAt,
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
      }));

      return NextResponse.json({ orders });
    }
  } catch (error) {
    console.error("Fetch orders error:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders." },
      { status: 500 }
    );
  }
}

