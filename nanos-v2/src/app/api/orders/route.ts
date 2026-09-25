import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth-server";
import { getProductById } from "@/lib/products";
import { prisma } from "@/lib/prisma";
import { isAutoBookCity } from "@/lib/postex";
import { MetaCapiService } from "@/lib/meta-capi";
import { reserveStock } from "@/lib/stock";
import { AppError } from "@/lib/order-state";
import { getPromoSettings, calculatePromoDiscount } from "@/lib/promo-settings";

// In-memory fallback order store for dev when DB is offline
export const memoryOrders = new Map<string, any>();

export async function POST(request: Request) {
  try {
    const authPayload = await verifyToken(request);
    const candidateUserId = authPayload?.sub || null;

    let validUserId: string | null = null;
    if (candidateUserId) {
      try {
        const userExists = await prisma.user.findUnique({
          where: { id: candidateUserId },
          select: { id: true },
        });
        if (userExists) {
          validUserId = userExists.id;
        }
      } catch {
        // If DB query fails or is in dev mock mode
      }
    }

    const body = await request.json();
    const { items, shippingInfo, promoCode, guestEmail, guestName, fbp, fbc, eventId } = body || {};

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
    const resolvedItems: any[] = [];

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

    let discount = 0;
    if (promoCode && items.length > 0) {
      try {
        const promoSettings = await getPromoSettings();
        if (
          promoSettings.enabled &&
          promoCode.trim().toUpperCase() === promoSettings.code.trim().toUpperCase() &&
          subtotal >= (promoSettings.minOrderAmount || 0)
        ) {
          discount = calculatePromoDiscount(promoSettings, subtotal);
        }
      } catch (err) {
        console.warn("Failed to check promo settings:", err);
      }
    }
    const afterDiscount = Math.max(0, subtotal - discount);
    const shipping = afterDiscount >= 5000 ? 0 : 250;
    const total = afterDiscount + shipping;

    const orderId = "ord_" + Math.random().toString(36).substring(2, 11);
    const now = new Date().toISOString();

    const isAuto = await isAutoBookCity(shippingInfo.city || "");
    const courierBookingStatus = "queued";

    const stockLines = resolvedItems.map((i) => ({
      productId: i.productId,
      color: i.color,
      size: i.size,
      qty: i.quantity,
    }));

    try {
      await prisma.$transaction(async (tx) => {
        const trackedMap = await reserveStock(tx, stockLines);

        const createdOrder = await tx.order.create({
          data: {
            id: orderId,
            userId: validUserId,
            guestEmail: validUserId ? null : guestEmail || shippingInfo.email,
            guestName: validUserId ? null : guestName || shippingInfo.name,
            subtotal,
            discount,
            shipping,
            total,
            shippingInfo: JSON.stringify(shippingInfo),
            payment: "cod",
            status: "placed",
            courierBookingStatus,
            stockReserved: true,
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
                  stockTracked: trackedMap[key] ?? true,
                };
              }),
            },
          },
        });

        await tx.orderEvent.create({
          data: {
            orderId: createdOrder.id,
            type: "created",
            toValue: "placed",
            actor: validUserId ? `user:${validUserId}` : "customer:guest",
          },
        });
      });
    } catch (txErr: any) {
      if (txErr instanceof AppError && txErr.code === "OUT_OF_STOCK") {
        return NextResponse.json(
          {
            error: "OUT_OF_STOCK",
            message: txErr.message,
            shortages: txErr.details?.shortages || [],
          },
          { status: 409 }
        );
      }
      throw txErr;
    }

    // Send CAPI events asynchronously (non-blocking)
    try {
      const clientIp =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        null;
      const clientUserAgent = request.headers.get("user-agent") || null;
      const eventSourceUrl =
        request.headers.get("referer") || "https://nanos.pk/checkout";

      const userData = {
        email: shippingInfo.email || guestEmail,
        phone: shippingInfo.phone,
        name: shippingInfo.name || guestName,
        city: shippingInfo.city,
        country: "pk",
        fbp,
        fbc,
        clientIp,
        clientUserAgent,
      };

      const contentIds = resolvedItems.map((i) => i.productId);
      const contents = resolvedItems.map((i) => ({
        id: i.productId,
        quantity: i.quantity,
        item_price: i.unitPrice,
      }));
      const numItems = resolvedItems.reduce((acc, i) => acc + i.quantity, 0);

      const customData = {
        value: total,
        currency: "PKR",
        content_type: "product",
        content_ids: contentIds,
        contents,
        num_items: numItems,
      };

      if (eventId) {
        MetaCapiService.sendEvent(
          "InitiateCheckout",
          eventId,
          eventSourceUrl,
          userData,
          customData
        );
      }

      MetaCapiService.sendEvent(
        "Purchase",
        orderId,
        eventSourceUrl,
        userData,
        customData
      );
    } catch (capiErr) {
      console.error("Failed to trigger CAPI events:", capiErr);
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

