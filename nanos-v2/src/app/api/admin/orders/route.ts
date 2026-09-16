import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { memoryOrders } from "@/app/api/orders/route";

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
      },
    });

    const orders = dbOrders.map((o) => ({
      id: o.id,
      status: o.status,
      subtotal: o.subtotal,
      discount: o.discount,
      shipping: o.shipping,
      total: o.total,
      shippingInfo: o.shippingInfo,
      payment: o.payment,
      guestEmail: o.guestEmail,
      guestName: o.guestName,
      createdAt: o.createdAt,
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
    }));

    return NextResponse.json({ orders });
  } catch {
    // Fallback to memoryOrders
    const memList = Array.from(memoryOrders.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const orders = memList.map((o) => ({
      id: o.id,
      status: o.status || "PENDING",
      subtotal: o.subtotal || 0,
      discount: o.discount || 0,
      shipping: o.shipping || 0,
      total: o.total || 0,
      shippingInfo: o.shippingInfo || "{}",
      payment: o.payment || "cod",
      guestEmail: o.guestEmail || null,
      guestName: o.guestName || null,
      createdAt: o.createdAt,
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
    }));

    return NextResponse.json({ orders });
  }
}
