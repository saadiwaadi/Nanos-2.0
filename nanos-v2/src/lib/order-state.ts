export const ORDER_STATUSES = [
  "placed",
  "confirmed",
  "on_hold",
  "shipped",
  "delivered",
  "returned",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const MANUAL: Record<OrderStatus, OrderStatus[]> = {
  placed: ["confirmed", "on_hold", "cancelled"],
  confirmed: ["shipped", "on_hold", "cancelled"],
  on_hold: ["confirmed", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  returned: [],
  cancelled: [],
};

export const allowedNext = (s: OrderStatus) => MANUAL[s] ?? [];
export const canManual = (f: OrderStatus, t: OrderStatus) => MANUAL[f]?.includes(t) ?? false;

const SYSTEM: Record<string, OrderStatus[]> = {
  placed: ["shipped", "delivered", "returned"],
  confirmed: ["shipped", "delivered", "returned"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
};

export const canSystem = (f: OrderStatus, t: OrderStatus) => SYSTEM[f]?.includes(t) ?? false;

// PostEx status text -> our status. null = no change (booked, unbooked, unknown).
export function mapCourierStatus(raw: string): OrderStatus | null {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.toLowerCase().trim();
  if (/\breturned\b/.test(s)) return "returned";
  if (/out for return|return in process|returning/.test(s)) return "shipped";
  if (/\bdelivered\b/.test(s) && !/un-?delivered|not delivered/.test(s)) return "delivered";
  if (/picked|warehouse|transit|en-?route|out for delivery|attempt|under review|dispatch/.test(s)) return "shipped";
  return null;
}

export class AppError extends Error {
  public status: number;
  public details: any;

  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
    public extra: any = {}
  ) {
    super(message);
    this.name = "AppError";
    this.status = httpStatus;
    this.details = extra;
  }
}

export async function transitionOrder(
  prisma: any,
  a: {
    orderId: string;
    to: OrderStatus;
    actor: string;
    reason?: string;
    expectedVersion?: number;
    system?: boolean;
  }
) {
  return prisma.$transaction(async (tx: any) => {
    const o = await tx.order.findUnique({
      where: { id: a.orderId },
      include: { items: true },
    });
    if (!o) throw new AppError("NOT_FOUND", "Order not found", 404);
    const from = o.status as OrderStatus;
    if (from === a.to) return o; // idempotent no-op
    if (a.expectedVersion !== undefined && o.version !== a.expectedVersion)
      throw new AppError(
        "STALE",
        "This order was changed elsewhere. Reload and try again.",
        409
      );
    const ok = a.system ? canSystem(from, a.to) : canManual(from, a.to);
    if (!ok)
      throw new AppError(
        "INVALID_TRANSITION",
        `Cannot move an order from "${from}" to "${a.to}".`,
        409
      );
    if (
      ["cancelled", "on_hold", "returned"].includes(a.to) &&
      !a.system &&
      !a.reason?.trim()
    )
      throw new AppError(
        "REASON_REQUIRED",
        "A reason is required for this change.",
        400
      );

    if (a.to === "cancelled") {
      if (o.courierBookingStatus === "booking_in_progress")
        throw new AppError(
          "BOOKING_ACTIVE",
          "This order is being booked right now. Try again in a minute.",
          409
        );
      if (o.courierBookingStatus === "booked" && (o.trackingNumber || o.postexTrackingNumber))
        throw new AppError(
          "COURIER_BOOKED",
          "Cancel the PostEx booking first.",
          409
        );
    }
    const r = await tx.order.updateMany({
      where: { id: o.id, version: o.version },
      data: {
        status: a.to,
        version: { increment: 1 },
        ...(a.to === "cancelled"
          ? { stockReserved: false, courierBookingStatus: "not_booked" }
          : {}),
      },
    });
    if (r.count === 0)
      throw new AppError(
        "STALE",
        "This order was changed elsewhere. Reload and try again.",
        409
      );
    await tx.orderEvent.create({
      data: {
        orderId: o.id,
        type: "status_change",
        fromValue: from,
        toValue: a.to,
        actor: a.actor,
        reason: a.reason,
      },
    });
    return tx.order.findUnique({
      where: { id: o.id },
      include: { items: true },
    });
  });
}
