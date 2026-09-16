import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { memoryOrders } from "@/app/api/orders/route";

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
      return NextResponse.json({ order: updated });
    } catch {
      return NextResponse.json({ order: memoryOrders.get(id) || { id, status: normStatus } });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update order status" }, { status: 500 });
  }
}
