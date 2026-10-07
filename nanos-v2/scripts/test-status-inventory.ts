import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { callTrackOrderApi, callSaveShipperAdviceApi } from "../src/lib/postex";

async function main() {
  console.log("===============================================================");
  console.log("STEP 1: INVENTORY AVAILABLE TEST ORDERS BY STATUS");
  console.log("===============================================================");

  // Find all orders with non-null and non-empty trackingNumber or postexTrackingNumber
  const allOrdersWithTracking = await prisma.order.findMany({
    where: {
      OR: [
        { trackingNumber: { not: null } },
        { postexTrackingNumber: { not: null } },
      ],
    },
    select: {
      id: true,
      orderStatus: true,
      status: true,
      courierBookingStatus: true,
      trackingNumber: true,
      postexTrackingNumber: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Found total ${allOrdersWithTracking.length} orders with tracking numbers in DB.`);

  // Group by orderStatus
  const byOrderStatus: Record<string, typeof allOrdersWithTracking> = {};
  for (const o of allOrdersWithTracking) {
    const key = o.orderStatus || "UNKNOWN";
    if (!byOrderStatus[key]) byOrderStatus[key] = [];
    byOrderStatus[key].push(o);
  }

  // Also check distinct courierBookingStatus / status
  const byCourierStatus: Record<string, typeof allOrdersWithTracking> = {};
  for (const o of allOrdersWithTracking) {
    const key = `${o.orderStatus} | status:${o.status} | courier:${o.courierBookingStatus}`;
    if (!byCourierStatus[key]) byCourierStatus[key] = [];
    byCourierStatus[key].push(o);
  }

  console.log("\n--- Grouped by orderStatus ---");
  for (const [st, list] of Object.entries(byOrderStatus)) {
    console.log(`Status "${st}": ${list.length} orders. Sample tracking: ${list[0].trackingNumber || list[0].postexTrackingNumber}`);
  }

  console.log("\n--- Grouped by full status profile ---");
  for (const [st, list] of Object.entries(byCourierStatus)) {
    console.log(`Profile [${st}]: ${list.length} orders. Sample tracking: ${list[0].trackingNumber || list[0].postexTrackingNumber}`);
  }
}

main().catch(console.error);
