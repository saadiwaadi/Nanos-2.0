import { prisma } from "@/lib/prisma";

export interface AccountStats {
  totalSpentDelivered: number;
  deliveredCount: number;
  inProgressCount: number;
  totalOrders: number;
}

export interface ActiveOrderItem {
  id: string;
  productId: string;
  name: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  hero?: string;
}

export interface ActiveOrder {
  id: string;
  shortId: string;
  createdAt: string;
  total: number;
  subtotal: number;
  shipping: number;
  status: string;
  courierBookingStatus: string;
  courierStatusRaw?: string | null;
  trackingNumber?: string | null;
  postexTrackingNumber?: string | null;
  trackingUrl?: string | null;
  itemCount: number;
  items: ActiveOrderItem[];
}

export interface UnreviewedItem {
  orderId: string;
  orderItemId: string;
  productId: string;
  productName: string;
  productHero: string;
  color: string;
  size: string;
  unitPrice: number;
  orderDate: string;
}

export interface AccountSummaryData {
  stats: AccountStats;
  activeOrders: ActiveOrder[];
  unreviewedItems: UnreviewedItem[];
  isNewUser: boolean;
}

export function isOrderDelivered(order: {
  status: string;
  courierBookingStatus?: string | null;
  courierStatusRaw?: string | null;
}): boolean {
  const status = (order.status || "").toLowerCase().trim();
  const courierStatus = (order.courierBookingStatus || "").toLowerCase().trim();
  const raw = (order.courierStatusRaw || "").toLowerCase().trim();

  if (status === "delivered") return true;
  if (courierStatus === "delivered") return true;
  if (raw.includes("delivered") && !raw.includes("not delivered") && !raw.includes("undelivered")) {
    return true;
  }
  return false;
}

export function isOrderInactive(order: {
  status: string;
  courierBookingStatus?: string | null;
  courierStatusRaw?: string | null;
}): boolean {
  const status = (order.status || "").toLowerCase().trim();
  const courierStatus = (order.courierBookingStatus || "").toLowerCase().trim();
  const raw = (order.courierStatusRaw || "").toLowerCase().trim();

  if (status === "cancelled" || status === "returned") return true;
  if (courierStatus === "cancelled" || courierStatus === "returned") return true;
  if (raw.includes("cancel") || raw.includes("return")) return true;
  return isOrderDelivered(order);
}

export async function getAccountSummary(userId: string): Promise<AccountSummaryData> {
  if (!userId) {
    throw new Error("User ID is required to get account summary.");
  }

  // 1. Fetch user orders with items, products, and reviews in a single query
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, hero: true, category: true },
          },
        },
      },
      reviews: {
        where: { userId },
        select: { productId: true, orderId: true, rating: true },
      },
    },
  });

  let totalSpentDelivered = 0;
  let deliveredCount = 0;
  let inProgressCount = 0;
  const activeOrders: ActiveOrder[] = [];
  const unreviewedItems: UnreviewedItem[] = [];

  for (const order of orders) {
    const delivered = isOrderDelivered(order);
    const inactive = isOrderInactive(order);

    if (delivered) {
      deliveredCount++;
      totalSpentDelivered += order.total;

      // Check for unreviewed items in this delivered order
      const reviewedProductIds = new Set((order.reviews || []).map((r: { productId: string }) => r.productId));

      for (const item of order.items) {
        if (!reviewedProductIds.has(item.productId)) {
          unreviewedItems.push({
            orderId: order.id,
            orderItemId: item.id,
            productId: item.productId,
            productName: item.name || item.product?.name || "Nanos Product",
            productHero: item.product?.hero || "",
            color: item.color,
            size: item.size,
            unitPrice: item.unitPrice,
            orderDate: order.createdAt.toISOString(),
          });
        }
      }
    } else if (!inactive) {
      // Order is actively in progress
      inProgressCount++;

      const trackingNum = order.trackingNumber || order.postexTrackingNumber || null;
      const trackingUrl = trackingNum
        ? `https://postex.pk/tracking?trackingNo=${encodeURIComponent(trackingNum)}`
        : null;

      const shortId = order.id.replace(/^ord_/, "").slice(0, 8).toUpperCase();
      const itemCount = order.items.reduce((sum: number, item: { quantity?: number }) => sum + (item.quantity || 1), 0);

      activeOrders.push({
        id: order.id,
        shortId,
        createdAt: order.createdAt.toISOString(),
        total: order.total,
        subtotal: order.subtotal,
        shipping: order.shipping,
        status: order.status,
        courierBookingStatus: order.courierBookingStatus,
        courierStatusRaw: order.courierStatusRaw,
        trackingNumber: trackingNum,
        postexTrackingNumber: order.postexTrackingNumber,
        trackingUrl,
        itemCount,
        items: order.items.map((i: any) => ({
          id: i.id,
          productId: i.productId,
          name: i.name || i.product?.name || "Item",
          color: i.color,
          size: i.size,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          hero: i.product?.hero || "",
        })),
      });
    }
  }

  const totalOrders = orders.length;
  const isNewUser = totalOrders === 0;

  return {
    stats: {
      totalSpentDelivered,
      deliveredCount,
      inProgressCount,
      totalOrders,
    },
    activeOrders,
    unreviewedItems,
    isNewUser,
  };
}
