import { prisma } from "@/lib/prisma";

export interface PostexCreateOrderPayload {
  cityName: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  invoiceDivision: number;
  invoicePayment: number;
  orderDetail: string;
  orderRefNumber: string;
  pickupAddressCode: string;
  orderType: string;
}

export interface PostexCreateOrderResponse {
  statusCode: string;
  statusMessage: string;
  dist?: {
    trackingNumber: string;
    orderStatus: string;
    orderDate: string;
  };
  error?: string;
  message?: string;
}

export interface PostexTrackOrderResponse {
  statusCode: string;
  statusMessage: string;
  dist?: {
    trackingNumber: string;
    transactionStatus: string;
    cityName: string;
    deliveryAddress: string;
    customerName: string;
    customerPhone: string;
    invoicePayment: number;
    orderRefNumber: string;
    transactionStatusHistory?: {
      transactionStatusMessage: string;
      transactionStatusMessageCode: string;
      updatedAt: string;
    }[];
  };
}

export const POSTEX_BASE_URL = (
  process.env.POSTEX_BASE_URL || "https://api.postex.pk"
).replace(/\/$/, "");

export const POSTEX_API_TOKEN = process.env.POSTEX_API_TOKEN || "";

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

export async function getPickupAddresses() {
  const url = `${POSTEX_BASE_URL}/services/integration/api/order/v1/get-merchant-address`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      token: POSTEX_API_TOKEN,
      "Content-Type": "application/json",
    },
  });
  return res.json();
}

export async function callCreateOrderApi(
  payload: PostexCreateOrderPayload
): Promise<PostexCreateOrderResponse> {
  const url = `${POSTEX_BASE_URL}/services/integration/api/order/v1/create-order`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      token: POSTEX_API_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return data as PostexCreateOrderResponse;
}

export async function callTrackOrderApi(
  trackingNumber: string
): Promise<PostexTrackOrderResponse> {
  const url = `${POSTEX_BASE_URL}/services/integration/api/order/v1/track-order/${encodeURIComponent(trackingNumber)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      token: POSTEX_API_TOKEN,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  return data as PostexTrackOrderResponse;
}

export async function callCancelOrderApi(trackingNumber: string) {
  const url = `${POSTEX_BASE_URL}/services/integration/api/order/v1/cancel-order`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      token: POSTEX_API_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ trackingNumber }),
  });
  return res.json();
}

export async function isAutoBookCity(city: string): Promise<boolean> {
  if (!city) return false;
  const normalized = city.trim().toLowerCase();

  try {
    const dbCities = await prisma.postexAutoBookCity.findMany({
      where: { enabled: true },
    });
    if (dbCities.length > 0) {
      return dbCities.some(
        (c) => c.cityName.trim().toLowerCase() === normalized
      );
    }
  } catch {
    // Fallback if table query fails
  }

  const defaultCities = ["lahore", "karachi", "gujrat"];
  return defaultCities.includes(normalized);
}

export async function bookSingleOrder(
  order: any,
  customPayloadOverride?: Partial<PostexCreateOrderPayload>
) {
  const shippingInfo = parseShippingInfo(order.shippingInfo);
  const customerName =
    shippingInfo.name || order.guestName || "Valued Customer";
  const customerPhone = shippingInfo.phone || "";
  const deliveryAddress = `${shippingInfo.address || ""}, ${shippingInfo.city || ""}`.trim();
  const cityName = shippingInfo.city || "Lahore";

  const itemDetails =
    Array.isArray(order.items) && order.items.length > 0
      ? order.items
          .map(
            (i: any) =>
              `${i.product?.name || i.name || "Item"} (${i.color}/${i.size}) x${i.quantity || i.qty || 1}`
          )
          .join(", ")
      : "nanos.pk order";

  const payload: PostexCreateOrderPayload = {
    cityName,
    customerName,
    customerPhone,
    deliveryAddress,
    invoiceDivision: 1,
    invoicePayment: order.total,
    orderDetail: itemDetails,
    orderRefNumber: order.id,
    pickupAddressCode: order.pickupAddressCode || "001",
    orderType: "Normal",
    ...customPayloadOverride,
  };

  let responseData: PostexCreateOrderResponse | null = null;
  let success = false;
  let errorMessage: string | null = null;

  try {
    responseData = await callCreateOrderApi(payload);

    if (
      responseData &&
      (responseData.statusCode === "200" || responseData.statusCode === "201") &&
      responseData.dist?.trackingNumber
    ) {
      success = true;
      const trackingNumber = responseData.dist.trackingNumber;
      const postexStatus = responseData.dist.orderStatus || "UnBooked";

      await prisma.order.update({
        where: { id: order.id },
        data: {
          postexTrackingNumber: trackingNumber,
          courierBookingStatus: "booked",
        },
      });
    } else {
      success = false;
      errorMessage =
        responseData?.statusMessage ||
        responseData?.message ||
        responseData?.error ||
        "PostEx API returned non-200 status code";

      await prisma.order.update({
        where: { id: order.id },
        data: {
          courierBookingStatus: "booking_failed",
        },
      });
    }
  } catch (err: any) {
    success = false;
    errorMessage = err.message || "Network error connecting to PostEx API";

    await prisma.order.update({
      where: { id: order.id },
      data: {
        courierBookingStatus: "booking_failed",
      },
    });
  }

  const log = await prisma.postexBookingLog.create({
    data: {
      orderId: order.id,
      requestPayload: JSON.stringify(payload),
      responsePayload: JSON.stringify(responseData || {}),
      success,
      errorMessage,
    },
  });

  return {
    orderId: order.id,
    success,
    errorMessage,
    log,
    response: responseData,
    request: payload,
  };
}

export async function processBatchBooking() {
  const eligibleOrders = await prisma.order.findMany({
    where: {
      OR: [
        { courierBookingStatus: "pending_auto" },
        { courierBookingStatus: "queued_for_batch" },
        {
          courierBookingStatus: "pending_manual_review",
          adminApproved: true,
        },
      ],
    },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  const results = [];
  for (const order of eligibleOrders) {
    const result = await bookSingleOrder(order);
    results.push(result);
  }

  return results;
}

export async function processBatchTracking() {
  const bookedOrders = await prisma.order.findMany({
    where: {
      courierBookingStatus: "booked",
      postexTrackingNumber: { not: null },
    },
  });

  const results = [];
  for (const order of bookedOrders) {
    if (!order.postexTrackingNumber) continue;
    try {
      const trackData = await callTrackOrderApi(order.postexTrackingNumber);
      if (trackData && trackData.statusCode === "200" && trackData.dist) {
        const rawStatus = trackData.dist.transactionStatus || "";
        let newCourierStatus = order.courierBookingStatus;

        const statusLower = rawStatus.toLowerCase();
        if (statusLower.includes("delivered")) {
          newCourierStatus = "delivered";
        } else if (
          statusLower.includes("return") ||
          statusLower.includes("cancel")
        ) {
          newCourierStatus = "returned";
        }

        await prisma.order.update({
          where: { id: order.id },
          data: {
            courierBookingStatus: newCourierStatus,
          },
        });

        await prisma.postexBookingLog.create({
          data: {
            orderId: order.id,
            requestPayload: JSON.stringify({
              action: "trackOrder",
              trackingNumber: order.postexTrackingNumber,
            }),
            responsePayload: JSON.stringify(trackData || {}),
            success: true,
          },
        });

        results.push({
          orderId: order.id,
          status: rawStatus,
          courierStatus: newCourierStatus,
        });
      }
    } catch {
      // Ignore error for single tracking item
    }
  }

  return results;
}

export async function retryOrderBooking(
  orderId: string,
  customPayload?: Partial<PostexCreateOrderPayload>
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  return bookSingleOrder(order, customPayload);
}

export async function getAdminCourierQueue() {
  const [awaitingApproval, queuedForBatch, failedBookings, bookedOrders] =
    await Promise.all([
      prisma.order.findMany({
        where: {
          courierBookingStatus: "pending_manual_review",
          adminApproved: false,
        },
        orderBy: { createdAt: "desc" },
        include: { bookingLogs: { orderBy: { attemptedAt: "desc" }, take: 1 } },
      }),
      prisma.order.findMany({
        where: {
          OR: [
            { courierBookingStatus: "pending_auto" },
            { courierBookingStatus: "queued_for_batch" },
            {
              courierBookingStatus: "pending_manual_review",
              adminApproved: true,
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        include: { bookingLogs: { orderBy: { attemptedAt: "desc" }, take: 1 } },
      }),
      prisma.order.findMany({
        where: { courierBookingStatus: "booking_failed" },
        orderBy: { createdAt: "desc" },
        include: { bookingLogs: { orderBy: { attemptedAt: "desc" }, take: 1 } },
      }),
      prisma.order.findMany({
        where: { courierBookingStatus: "booked" },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { bookingLogs: { orderBy: { attemptedAt: "desc" }, take: 1 } },
      }),
    ]);

  return {
    awaitingApproval,
    queuedForBatch,
    failedBookings,
    bookedOrders,
  };
}

export async function approveManualOrder(orderId: string) {
  return prisma.order.update({
    where: { id: orderId },
    data: {
      adminApproved: true,
      courierBookingStatus: "queued_for_batch",
    },
  });
}
