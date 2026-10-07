import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { callTrackOrderApi } from "../src/lib/postex";

async function main() {
  const allDbOrders = await prisma.order.groupBy({
    by: ['orderStatus'],
    _count: true,
  });
  console.log("All DB orders by orderStatus:", allDbOrders);

  const ordersWithTracking = await prisma.order.findMany({
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
    }
  });

  console.log(`\nQuerying PostEx live status for all ${ordersWithTracking.length} tracking numbers...`);
  
  const postexStatusMap: Record<string, { order: any; trackRes: any }[]> = {};

  for (const o of ordersWithTracking) {
    const tn = (o.trackingNumber || o.postexTrackingNumber || "").trim();
    if (!tn) continue;

    try {
      const trackRes = await callTrackOrderApi(tn);
      const postexStatus = trackRes?.dist?.transactionStatus || "UNKNOWN";
      if (!postexStatusMap[postexStatus]) postexStatusMap[postexStatus] = [];
      postexStatusMap[postexStatus].push({ order: o, trackRes });
      console.log(`Tracking: ${tn} | DB orderStatus: ${o.orderStatus} | PostEx transactionStatus: ${postexStatus}`);
    } catch (err: any) {
      console.log(`Tracking: ${tn} | PostEx track error: ${err.message}`);
    }
    // Small sleep
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log("\nSummary of PostEx live statuses found:");
  for (const [st, list] of Object.entries(postexStatusMap)) {
    console.log(`PostEx status "${st}": ${list.length} orders. Sample tracking: ${(list[0].order.trackingNumber || list[0].order.postexTrackingNumber)}`);
  }
}

main().catch(console.error);
