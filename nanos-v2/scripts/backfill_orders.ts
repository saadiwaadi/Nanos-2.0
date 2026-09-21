import "dotenv/config";
import { prisma } from "../src/lib/prisma";

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

async function main() {
  console.log("=== Backfilling Order Statuses & Customer Info ===");

  const orders = await prisma.order.findMany({
    include: { user: true },
  });
  console.log(`Found ${orders.length} total orders to process.`);

  let updatedCount = 0;

  for (const o of orders) {
    const orderAny = o as any;
    let newStatus = o.status;
    let newCourierBookingStatus = o.courierBookingStatus;
    const tracking = orderAny.postexTrackingNumber || orderAny.trackingNumber || null;

    const rawStatus = (o.status || "").toLowerCase().trim();

    // Normalize lifecycle status
    if (rawStatus === "processing" || rawStatus === "pending" || rawStatus === "") {
      newStatus = tracking ? "confirmed" : "placed";
    } else if (rawStatus === "delivered") {
      newStatus = "delivered";
    } else if (rawStatus === "cancelled") {
      newStatus = "cancelled";
    } else if (rawStatus === "shipped") {
      newStatus = "shipped";
    }

    // Normalize courier booking status
    const rawCourierStatus = (o.courierBookingStatus || "").trim();
    if (!rawCourierStatus || rawCourierStatus === "N/A" || rawCourierStatus === "null") {
      newCourierBookingStatus = tracking ? "booked" : "not_booked";
    }

    const sInfo = parseShippingInfo(o.shippingInfo);
    const cName = orderAny.customerName || sInfo.name || o.user?.name || o.guestName || "Guest";
    const cEmail = orderAny.customerEmail || sInfo.email || o.user?.email || o.guestEmail || "No email";

    await (prisma.order as any).update({
      where: { id: o.id },
      data: {
        status: newStatus,
        courierBookingStatus: newCourierBookingStatus,
        trackingNumber: tracking,
        customerName: cName,
        customerEmail: cEmail,
      },
    });

    updatedCount++;
  }

  console.log(`Backfill completed. Updated ${updatedCount} orders.`);

  const nullCountRes: any = await prisma.$queryRaw`SELECT count(*)::int FROM "Order" WHERE "customerName" IS NULL`;
  console.log("Null customerName count result:", nullCountRes);
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
