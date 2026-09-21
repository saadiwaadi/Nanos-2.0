import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { memoryOrders } from "../route";

function parseShippingInfo(val: string) {
  try {
    return typeof val === "string" ? JSON.parse(val) : val;
  } catch {
    return {};
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const queryEmail = searchParams.get("email")?.trim().toLowerCase();

    const authPayload = await verifyToken(request);
    const sub = authPayload?.sub || null;

    let order = memoryOrders.get(id);

    if (!order) {
      try {
        const dbOrder = await prisma.order.findUnique({
          where: { id },
          include: { items: true },
        });
        if (dbOrder) {
          order = {
            id: dbOrder.id,
            userId: dbOrder.userId,
            guestEmail: dbOrder.guestEmail,
            guestName: dbOrder.guestName,
            subtotal: dbOrder.subtotal,
            discount: dbOrder.discount,
            shipping: dbOrder.shipping,
            total: dbOrder.total,
            shippingInfo: dbOrder.shippingInfo,
            payment: dbOrder.payment,
            status: dbOrder.status,
            createdAt: dbOrder.createdAt.toISOString(),
            items: dbOrder.items.map((i) => ({
              productId: i.productId,
              name: i.name,
              sku: i.sku,
              color: i.color,
              size: i.size,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
            })),
          };
        }
      } catch {
        // DB offline
      }
    }

    if (!order) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Order not found." } },
        { status: 404 }
      );
    }

    // Access authorization check
    if (sub) {
      // Logged in user: match userId
      if (order.userId && order.userId !== sub) {
        return NextResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Unauthorized access to order." } },
          { status: 404 }
        );
      }
    } else {
      // Guest user: require email match
      if (
        order.guestEmail &&
        queryEmail !== order.guestEmail.trim().toLowerCase()
      ) {
        return NextResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Unauthorized access to order." } },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({
      id: order.id,
      status: order.status,
      total: order.total,
      subtotal: order.subtotal,
      discount: order.discount,
      shipping: order.shipping,
      shippingInfo: parseShippingInfo(order.shippingInfo),
      payment: order.payment,
      createdAt: order.createdAt,
      items: order.items.map((i: any) => ({
        productId: i.productId,
        name: i.name,
        sku: i.sku,
        color: i.color,
        size: i.size,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    });
  } catch (error) {
    console.error("Fetch order error:", error);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to fetch order." } },
      { status: 500 }
    );
  }
}
