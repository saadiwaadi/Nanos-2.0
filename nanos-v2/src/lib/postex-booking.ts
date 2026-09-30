import { prisma } from "@/lib/prisma";
import { postexFetch, PostexError } from "@/lib/postex-client";
import { transitionOrder, AppError } from "@/lib/order-state";

const STALE_LOCK_MS = 10 * 60_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── 3.5 CITY RESOLUTION & PHONE CLEANING ────────────────
let cityCache: {
  at: number;
  normMap: Map<string, string>;
  compactMap: Map<string, string>;
} | null = null;

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const compact = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]/g, "");

const ALIASES: Record<string, string> = {
  lhr: "lahore",
  khi: "karachi",
  isb: "islamabad",
  isalamabad: "islamabad",
  pindi: "rawalpindi",
  rwp: "rawalpindi",
  fsd: "faisalabad",
  mul: "multan",
  pesh: "peshawar",
  psh: "peshawar",
  hyd: "hyderabad",
  skt: "sialkot",
  gjt: "gujrat",
  grw: "gujranwala",
  bhv: "bahawalpur",
  bwp: "bahawalpur",
  swl: "sahiwal",
  ryk: "rahim yar khan",
  dgk: "dera ghazi khan",
  dgkhan: "dera ghazi khan",
  dik: "dera ismail khan",
  dikhan: "dera ismail khan",
  abb: "abbottabad",
  atd: "abbottabad",
  mzd: "muzaffarabad",
  mirpur: "mirpur ajk",
  sheikhoopura: "sheikhupura",
  nowshehra: "nowshera",
  charsada: "charsadda",
  mandibahauddin: "mandi bahauddin",
  tobateksingh: "toba tek singh",
};

const STOP_WORDS = new Set([
  "city", "district", "distt", "dist", "tehsil", "pakistan",
  "punjab", "sindh", "kpk", "balochistan", "ajk", "cantt", "cantonment",
  "phase", "sector", "block", "town", "society", "colony", "scheme",
  "bazar", "bazaar", "market", "road", "street", "st", "rd", "near",
  "opposite", "opp", "behind", "house", "h", "no", "flat", "floor",
  "mohallah", "village", "vpo", "chak"
]);

export function cleanPhone(phone: string): string {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("0092")) {
    digits = "0" + digits.slice(4);
  } else if (digits.startsWith("92") && digits.length >= 12) {
    digits = "0" + digits.slice(2);
  } else if (digits.length === 10 && !digits.startsWith("0")) {
    digits = "0" + digits;
  }
  return digits;
}

export async function resolveCity(input: string): Promise<string | null> {
  if (!input) return null;
  if (!cityCache || Date.now() - cityCache.at > 6 * 3600_000) {
    try {
      let r: any;
      try {
        r = await postexFetch("/order/v2/get-operational-city");
      } catch {
        r = await postexFetch("/order/v1/get-operational-city");
      }

      const cities = r?.dist || (Array.isArray(r) ? r : []);
      if (Array.isArray(cities) && cities.length > 0) {
        const normMap = new Map<string, string>();
        const compactMap = new Map<string, string>();

        for (const c of cities) {
          if (!c?.operationalCityName) continue;
          const official = c.operationalCityName;
          normMap.set(norm(official), official);
          compactMap.set(compact(official), official);
        }

        cityCache = {
          at: Date.now(),
          normMap,
          compactMap,
        };
      }
    } catch {
      // Fallback below
    }

    if (!cityCache) {
      const defaultOperational = [
        "Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad",
        "Multan", "Peshawar", "Quetta", "Sialkot", "Gujrat", "Gujranwala",
        "Vehari", "HASIL PUR", "Sahiwal", "Bahawalpur", "Sargodha", "Hyderabad", "Sukkur"
      ];
      const normMap = new Map<string, string>();
      const compactMap = new Map<string, string>();
      for (const c of defaultOperational) {
        normMap.set(norm(c), c);
        compactMap.set(compact(c), c);
      }
      cityCache = {
        at: Date.now(),
        normMap,
        compactMap,
      };
    }
  }

  const k = norm(input);
  if (!k) return null;

  const normMap = cityCache.normMap;
  const compactMap = cityCache.compactMap;

  // 1. Direct match or alias match
  const aliasK = ALIASES[k] ?? k;
  if (normMap.has(aliasK)) return normMap.get(aliasK)!;

  // 2. Compact match (e.g. "Hasilpur" -> "hasilpur" -> "HASIL PUR")
  const compK = compact(aliasK);
  if (compactMap.has(compK)) return compactMap.get(compK)!;
  if (ALIASES[compK] && compactMap.has(compact(ALIASES[compK]))) {
    return compactMap.get(compact(ALIASES[compK]))!;
  }

  // 3. Token / stripped match
  const words = k.split(" ").filter((w) => w.length > 0);
  const cleanWords = words.filter((w) => !STOP_WORDS.has(w));
  const cleanStr = cleanWords.join(" ");
  if (cleanStr) {
    const aliasClean = ALIASES[cleanStr] ?? cleanStr;
    if (normMap.has(aliasClean)) return normMap.get(aliasClean)!;
    const compClean = compact(aliasClean);
    if (compactMap.has(compClean)) return compactMap.get(compClean)!;
  }

  // 4. Individual word or compacted word matches
  for (const w of words) {
    if (w.length >= 3 && !STOP_WORDS.has(w)) {
      const aliasW = ALIASES[w] ?? w;
      if (normMap.has(aliasW)) return normMap.get(aliasW)!;
      const compW = compact(aliasW);
      if (compactMap.has(compW)) return compactMap.get(compW)!;
    }
  }

  // 5. Longest dictionary substring scan
  let longest: string | null = null;
  let maxLen = 0;
  for (const [normCity, official] of normMap.entries()) {
    if (normCity.length >= 4 && k.includes(normCity)) {
      if (normCity.length > maxLen) {
        maxLen = normCity.length;
        longest = official;
      }
    }
  }
  if (longest) return longest;

  // 6. Compact substring scan
  for (const [compCity, official] of compactMap.entries()) {
    if (compCity.length >= 4 && compK.includes(compCity)) {
      if (compCity.length > maxLen) {
        maxLen = compCity.length;
        longest = official;
      }
    }
  }

  return longest;
}

// ─── CLAIM LOCK ─────────────────────────────────────────
export async function claim(id: string): Promise<boolean> {
  const r = await prisma.order.updateMany({
    where: {
      id,
      orderStatus: { not: "ON_HOLD" },
      status: { in: ["placed", "confirmed"] },
      OR: [
        {
          courierBookingStatus: {
            in: [
              "queued",
              "queued_for_batch",
              "pending_auto",
              "pending_manual_review",
              "awaiting_approval",
              "booking_failed",
              "not_booked",
            ],
          },
        },
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
  const pickupAddressCode = process.env.POSTEX_PICKUP_ADDRESS_CODE;
  if (!pickupAddressCode) {
    throw new Error("POSTEX_PICKUP_ADDRESS_CODE is not set");
  }

  const sInfo = parseShippingInfo(order.shippingInfo);
  const customerName = (sInfo.name || order.customerName || order.guestName || "Valued Customer").trim();
  const customerPhone = cleanPhone(sInfo.phone || "");
  const baseAddress = (sInfo.address || "").trim();
  const deliveryAddress = baseAddress ? `${baseAddress}, ${city}`.trim() : city;

  const orderItems = order.items || order.orderItems || [];
  const totalPieces =
    orderItems.reduce((sum: number, i: any) => sum + (Number(i.quantity ?? i.qty) || 1), 0) || 1;
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
    invoicePayment: Math.max(0, Number(order.total) || 0),
    items: totalPieces,
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

  if (order.orderStatus === "ON_HOLD" || order.status === "on_hold") {
    await prisma.order.update({
      where: { id },
      data: {
        courierBookingStatus: "not_booked",
        bookingLockedAt: null,
      },
    });
    return { id, result: "skipped" as const, reason: "Order is On Hold" };
  }

  const sInfo = parseShippingInfo(order.shippingInfo);
  const rawCity = sInfo.city || (order as any).city || "";
  let city = await resolveCity(rawCity);
  if (!city && sInfo.address) {
    city = await resolveCity(sInfo.address);
  }

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
        const updateRes = await tx.order.updateMany({
          where: { id, version: order.version },
          data: {
            orderStatus: "BOOKED",
            courierBookingStatus: "booked",
            trackingNumber: tracking,
            bookingError: null,
            bookingAmbiguous: false,
            bookingLockedAt: null,
            courierStatusRaw: "Booked",
            version: { increment: 1 },
          },
        });
        if (updateRes.count === 0) {
          throw new AppError("STALE", "Order version changed during booking.", 409);
        }
        await tx.orderEvent.create({
          data: {
            orderId: id,
            type: "booking",
            toValue: "booked",
            actor,
            metadata: JSON.stringify({ tracking }),
          },
        });
        await tx.orderAuditLog.create({
          data: {
            orderId: id,
            action: "SEND_POSTEX",
            adminUser: actor,
            note: `Booked with PostEx (Tracking #${tracking})`,
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

  return { id, result: "failed" as const, error: "Max booking attempts reached" };
}

// ─── RUN BATCH ──────────────────────────────────────────
export async function runBatch(
  limitOrOptions?: number | {
    limit?: number;
    concurrency?: number;
    includeAllUnbooked?: boolean;
  },
  concurrencyArg?: number
) {
  let limit = 200;
  let concurrency = 5;
  let includeAllUnbooked = false;

  if (typeof limitOrOptions === "number") {
    limit = limitOrOptions;
    if (typeof concurrencyArg === "number") {
      concurrency = concurrencyArg;
    }
  } else if (limitOrOptions && typeof limitOrOptions === "object") {
    limit = limitOrOptions.limit ?? 200;
    concurrency = limitOrOptions.concurrency ?? 5;
    includeAllUnbooked = limitOrOptions.includeAllUnbooked ?? false;
  }

  const targetStatuses = includeAllUnbooked
    ? [
        "queued",
        "queued_for_batch",
        "pending_auto",
        "pending_manual_review",
        "awaiting_approval",
        "booking_failed",
        "not_booked",
      ]
    : ["queued", "queued_for_batch", "pending_auto"];

  const ids = (
    await prisma.order.findMany({
      where: {
        orderStatus: { notIn: ["ON_HOLD", "CANCELLED", "BOOKED"] },
        status: { in: ["placed", "confirmed"] },
        trackingNumber: null,
        postexTrackingNumber: null,
        courierBookingStatus: { in: targetStatuses },
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
    skipped: results.filter((r) => r?.result === "skipped").length,
    aborted,
    details: results,
  };
}
