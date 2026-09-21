import { prisma } from "@/lib/prisma";
import { postexFetch, PostexError } from "@/lib/postex-client";
import { transitionOrder } from "@/lib/order-state";

const STALE_LOCK_MS = 10 * 60_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── 3.5 CITY RESOLUTION ────────────────────────────────
let cityCache: { at: number; set: Map<string, string> } | null = null;

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();

const ALIASES: Record<string, string> = {
  lhr: "lahore",
  khi: "karachi",
  isb: "islamabad",
  isalamabad: "islamabad",
  pindi: "rawalpindi",
};

export async function resolveCity(input: string): Promise<string | null> {
  if (!input) return null;
  if (!cityCache || Date.now() - cityCache.at > 6 * 3600_000) {
    try {
      const r: any = await postexFetch(
        "/order/v1/get-operational-city?operationalCityType=Delivery"
      );
      const cities = r?.dist ?? [];
      if (Array.isArray(cities) && cities.length > 0) {
        cityCache = {
          at: Date.now(),
          set: new Map(
            cities.map((c: any) => [norm(c.operationalCityName), c.operationalCityName])
          ),
        };
      }
    } catch {
      // Fallback below
    }

    if (!cityCache) {
      const defaultOperational = [
        "Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad",
        "Multan", "Peshawar", "Quetta", "Sialkot", "Gujrat", "Gujranwala"
      ];
      cityCache = {
        at: Date.now(),
        set: new Map(defaultOperational.map((c) => [norm(c), c])),
      };
    }
  }
  const k = norm(input);
  return cityCache.set.get(ALIASES[k] ?? k) ?? null;
}

// ─── CLAIM LOCK ─────────────────────────────────────────
export async function claim(id: string): Promise<boolean> {
  const r = await prisma.order.updateMany({
    where: {
      id,
      status: { in: ["placed", "confirmed"] },
      OR: [
        { courierBookingStatus: { in: ["queued", "booking_failed", "not_booked"] } },
        {
          courierBookingStatus: "booking_in_progress",
          bookingLockedAt: { lt: new Date(Date.now() - STALE_LOCK_MS) },
        },
      ],
    },
    data: {
      courierBookingStatus: "booking_in_progress",
      bookingLockedAt: new Date(),
      bookingAttempts: { increment: 1 },
    },
  });
  return r.count === 1;
}

function parseShippingInfo(val: any) {
  if (!val) return {};
  if (typeof val === "object") return val;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return {};
    }
  }
  return {};
}

export function buildPostexPayload(order: any, city: string) {
  const sInfo = parseShippingInfo(order.shippingInfo);
  const customerName = sInfo.name || order.customerName || order.guestName || "Customer";
  const customerPhone = sInfo.phone || "";
  const deliveryAddress = `${sInfo.address || ""}, ${city}`.trim();
  const pickupAddressCode =
    process.env.POSTEX_PICKUP_ADDRESS_CODE || order.pickupAddressCode || "001";

  const orderItems = order.items || order.orderItems || [];
  const itemDetails =
    orderItems.length > 0
      ? orderItems
          .map(
            (i: any) =>
              `${i.product?.name || i.name || "Item"} (${i.color}/${i.size}) x${i.quantity ?? i.qty ?? 1}`
          )
          .join(", ")
      : "nanos.pk order";

  return {
    cityName: city,
    customerName,
    customerPhone,
    deliveryAddress,
    invoiceDivision: 1,
    invoicePayment: order.total,
    orderDetail: itemDetails,
    orderRefNumber: order.id,
    pickupAddressCode,
    orderType: "Normal",
  };
}

// ─── BOOK ONE ORDER ─────────────────────────────────────
export async function bookOne(id: string, actor = "system:batch") {
  if (!(await claim(id))) return { id, result: "skipped" as const };

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { product: true } } },
  });

  if (!order) return { id, result: "skipped" as const };

  const sInfo = parseShippingInfo(order.shippingInfo);
  const rawCity = sInfo.city || (order as any).city || "";
  const city = await resolveCity(rawCity);

  if (!city) {
    await prisma.order.update({
      where: { id },
      data: {
        courierBookingStatus: "awaiting_approval",
        bookingError: `City not serviceable by PostEx: "${rawCity}"`,
        bookingLockedAt: null,
      },
    });
    return { id, result: "needs_review" as const };
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const payload = buildPostexPayload(order, city);
      const r: any = await postexFetch("/order/v1/create-order", {
        method: "POST",
        body: payload,
      });

      const tracking = r?.dist?.trackingNumber;
      if (!tracking) {
        throw new PostexError("REQUEST", "PostEx returned no tracking number", false);
      }

      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id },
          data: {
            courierBookingStatus: "booked",
            trackingNumber: tracking,
            bookingError: null,
            bookingAmbiguous: false,
            bookingLockedAt: null,
            courierStatusRaw: "Booked",
            version: { increment: 1 },
          },
        });
        await tx.orderEvent.create({
          data: {
            orderId: id,
            type: "booking",
            toValue: "booked",
            actor,
            metadata: JSON.stringify({ tracking }),
          },
        });
      });

      if (order.status === "placed") {
        await transitionOrder(prisma, {
          orderId: id,
          to: "confirmed",
          actor,
          system: false,
        });
      }

      return { id, result: "booked" as const, tracking };
    } catch (e: any) {
      if (e.code === "AUTH" || e.code === "CONFIG") {
        // config problem: do NOT mark the order failed
        await prisma.order.update({
          where: { id },
          data: {
            courierBookingStatus: "queued",
            bookingLockedAt: null,
            bookingAttempts: { decrement: 1 },
            bookingError: e.message,
          },
        });
        return { id, result: "abort" as const, error: e.message };
      }

      if (e.retryable && attempt < 3) {
        await sleep(600 * 2 ** attempt);
        continue;
      }

      await prisma.order.update({
        where: { id },
        data: {
          courierBookingStatus: "booking_failed",
          bookingLockedAt: null,
          bookingError: e.message,
          bookingAmbiguous: e.code === "TIMEOUT" || e.code === "NETWORK",
        },
      });

      await prisma.orderEvent.create({
        data: {
          orderId: id,
          type: "booking",
          toValue: "booking_failed",
          actor,
          reason: e.message,
        },
      });

      return { id, result: "failed" as const, error: e.message };
    }
  }
}

// ─── RUN BATCH ──────────────────────────────────────────
export async function runBatch(limit = 200, concurrency = 5) {
  const ids = (
    await prisma.order.findMany({
      where: {
        courierBookingStatus: { in: ["queued", "queued_for_batch", "pending_auto"] },
        status: { in: ["placed", "confirmed"] },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: { id: true },
    })
  ).map((o) => o.id);

  const results: any[] = [];
  let i = 0;
  let aborted: string | null = null;

  const worker = async () => {
    while (i < ids.length && !aborted) {
      const idx = i++;
      if (idx < ids.length) {
        const r = await bookOne(ids[idx]);
        results.push(r);
        if (r?.result === "abort") aborted = r.error;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, ids.length) }, worker)
  );

  return {
    total: ids.length,
    booked: results.filter((r) => r?.result === "booked").length,
    failed: results.filter((r) => r?.result === "failed").length,
    needsReview: results.filter((r) => r?.result === "needs_review").length,
    aborted,
  };
}
