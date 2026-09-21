import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("=== Backfilling Order Statuses & Courier Booking Statuses ===");

  const orders = await prisma.order.findMany();
  console.log(`Found ${orders.length} total orders to process.`);

  let updatedCount = 0;

  for (const o of orders) {
    let newStatus = o.status;
    let newCourierBookingStatus = o.courierBookingStatus;
    const tracking = o.postexTrackingNumber || o.trackingNumber;

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

    await prisma.order.update({
      where: { id: o.id },
      data: {
        status: newStatus,
        courierBookingStatus: newCourierBookingStatus,
        trackingNumber: tracking || o.trackingNumber,
      },
    });

    updatedCount++;
  }

  console.log(`Backfill completed. Updated ${updatedCount} orders.`);
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
