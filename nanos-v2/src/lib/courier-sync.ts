import { prisma } from "@/lib/prisma";
import { postexFetch } from "@/lib/postex-client";
import { mapCourierStatus, canSystem, transitionOrder, OrderStatus } from "@/lib/order-state";

export async function syncCourierStatus(limit = 500, concurrency = 5) {
  const threeHoursAgo = new Date(Date.now() - 3 * 3600_000);

  const orders = await prisma.order.findMany({
    where: {
      trackingNumber: { not: null },
      status: { in: ["confirmed", "shipped"] },
      OR: [
        { courierSyncedAt: null },
        { courierSyncedAt: { lt: threeHoursAgo } },
      ],
    },
    take: limit,
    select: {
      id: true,
      status: true,
      trackingNumber: true,
      version: true,
    },
  });

  const results: any[] = [];
  let i = 0;

  const worker = async () => {
    while (i < orders.length) {
      const order = orders[i++];
      if (!order || !order.trackingNumber) continue;

      try {
        const trackRes: any = await postexFetch(
          `/order/v1/track-order/${encodeURIComponent(order.trackingNumber)}`
        );
        const dist = trackRes?.dist;
        const rawStatus = dist?.transactionStatus || dist?.orderStatus || "";

        await prisma.order.updateMany({
          where: { id: order.id, version: order.version },
          data: {
            courierStatusRaw: rawStatus || "Unknown",
            courierSyncedAt: new Date(),
            version: { increment: 1 },
          },
        });

        const rawLower = rawStatus.toLowerCase();
        if (rawLower.includes("cancel")) {
          await prisma.order.updateMany({
            where: { id: order.id, version: order.version + 1 },
            data: { courierBookingStatus: "cancelled", version: { increment: 1 } },
          });
          results.push({ id: order.id, status: rawStatus, action: "marked_courier_cancelled" });
          continue;
        }

        const targetStatus = mapCourierStatus(rawStatus);
        if (targetStatus && canSystem(order.status as OrderStatus, targetStatus)) {
          await transitionOrder(prisma, {
            orderId: order.id,
            to: targetStatus,
            expectedVersion: order.version,
            actor: "system:sync",
            system: true,
          });
          results.push({ id: order.id, status: rawStatus, transitionedTo: targetStatus });
        } else {
          results.push({ id: order.id, status: rawStatus, action: "none" });
        }
      } catch (err: any) {
        results.push({ id: order.id, error: err.message });
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, orders.length) }, worker)
  );

  return { total: orders.length, results };
}
