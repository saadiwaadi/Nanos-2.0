import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { isOrderDelivered } from "@/lib/account-summary";

export async function POST(request: Request) {
  try {
    const authPayload = await verifyToken(request);
    const userId = authPayload?.sub || null;

    if (!userId) {
      return NextResponse.json(
        { error: "You must be logged in to submit a review." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { orderId, productId, rating, text } = body || {};

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json(
        { error: "Order ID is required." },
        { status: 400 }
      );
    }

    if (!productId || typeof productId !== "string") {
      return NextResponse.json(
        { error: "Product ID is required." },
        { status: 400 }
      );
    }

    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return NextResponse.json(
        { error: "Rating must be an integer between 1 and 5." },
        { status: 400 }
      );
    }

    // 1. Fetch order with items to validate ownership and delivered status
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    // 2. Validate order ownership
    if (order.userId !== userId) {
      return NextResponse.json(
        { error: "You can only review items from your own orders." },
        { status: 403 }
      );
    }

    // 3. Validate order is Delivered
    if (!isOrderDelivered(order)) {
      return NextResponse.json(
        { error: "Reviews can only be submitted for delivered orders." },
        { status: 400 }
      );
    }

    // 4. Validate that the product was actually part of this order
    const hasProduct = order.items.some((item) => item.productId === productId);
    if (!hasProduct) {
      return NextResponse.json(
        { error: "This product was not part of the specified order." },
        { status: 400 }
      );
    }

    // 5. Create or update review with unique constraint (userId, productId, orderId)
    const review = await prisma.review.upsert({
      where: {
        userId_productId_orderId: {
          userId,
          productId,
          orderId,
        },
      },
      create: {
        userId,
        productId,
        orderId,
        rating: numRating,
        text: text ? String(text).trim() : null,
      },
      update: {
        rating: numRating,
        text: text ? String(text).trim() : null,
      },
    });

    // 6. Recalculate aggregate product rating and review count
    try {
      const allProductReviews = await prisma.review.findMany({
        where: { productId },
        select: { rating: true },
      });

      if (allProductReviews.length > 0) {
        const sum = allProductReviews.reduce((acc: number, r: { rating: number }) => acc + r.rating, 0);
        const avgRating = Number((sum / allProductReviews.length).toFixed(1));

        await prisma.product.update({
          where: { id: productId },
          data: {
            rating: avgRating,
            reviews: allProductReviews.length,
          },
        });
      }
    } catch (aggErr) {
      console.warn("Failed to update product rating stats:", aggErr);
    }

    return NextResponse.json({
      success: true,
      message: "Review submitted successfully! Thank you.",
      review: {
        ...review,
        verifiedBuyer: true,
      },
    });
  } catch (err: any) {
    console.error("Error submitting review:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to submit review." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json(
        { error: "productId is required." },
        { status: 400 }
      );
    }

    const reviews = await prisma.review.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { name: true },
        },
      },
      take: 50,
    });

    return NextResponse.json({
      reviews: reviews.map((r: { id: string; rating: number; text: string | null; createdAt: Date; user: { name: string | null } | null }) => ({
        id: r.id,
        rating: r.rating,
        text: r.text,
        createdAt: r.createdAt,
        userName: r.user?.name || "Customer",
        verifiedBuyer: true,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch reviews." },
      { status: 500 }
    );
  }
}
