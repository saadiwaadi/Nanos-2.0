import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import {
  ORDER_STATUSES,
  OrderStatus,
  transitionOrder,
  AppError,
} from "@/lib/order-state";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(req);
  if ("error" in admin) {
    const status = admin.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "UNAUTHORIZED", message: "Unauthorized" }, { status });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { to, expectedVersion, reason } = body || {};

  if (!ORDER_STATUSES.includes(to as OrderStatus)) {
    return NextResponse.json(
      { error: "BAD_STATUS", message: `Unknown status "${to}"` },
      { status: 400 }
    );
  }

  try {
    const adminEmail = (admin as any).email || "admin@nanos.pk";
    const order = await transitionOrder(prisma, {
      orderId: id,
      to: to as OrderStatus,
      expectedVersion: typeof expectedVersion === "number" ? expectedVersion : undefined,
      reason,
      actor: adminEmail,
    });
    return NextResponse.json({ ok: true, order });
  } catch (e: any) {
    if (e instanceof AppError) {
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status: e.httpStatus }
      );
    }
    console.error("[order-status]", e);
    return NextResponse.json(
      { error: "INTERNAL", message: "Unexpected server error" },
      { status: 500 }
    );
  }
}
