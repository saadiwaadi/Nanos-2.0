import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Clearing test data from database...");

  const deletedAuditLogs = await (prisma as any).orderAuditLog?.deleteMany({});
  console.log(`Deleted ${deletedAuditLogs?.count ?? 0} OrderAuditLog records`);

  const deletedBookingLogs = await prisma.postexBookingLog.deleteMany({});
  console.log(`Deleted ${deletedBookingLogs.count} PostexBookingLog records`);

  const deletedEvents = await prisma.orderEvent.deleteMany({});
  console.log(`Deleted ${deletedEvents.count} OrderEvent records`);

  const deletedOrderItems = await prisma.orderItem.deleteMany({});
  console.log(`Deleted ${deletedOrderItems.count} OrderItem records`);

  const deletedOrders = await prisma.order.deleteMany({});
  console.log(`Deleted ${deletedOrders.count} Order records`);

  const deletedCartItems = await prisma.cartItem.deleteMany({});
  console.log(`Deleted ${deletedCartItems.count} CartItem records`);

  const deletedCarts = await prisma.cart.deleteMany({});
  console.log(`Deleted ${deletedCarts.count} Cart records`);

  const deletedWishlist = await prisma.wishlistItem.deleteMany({});
  console.log(`Deleted ${deletedWishlist.count} WishlistItem records`);

  const deletedReviews = await prisma.review.deleteMany({});
  console.log(`Deleted ${deletedReviews.count} Review records`);

  console.log("Database cleared of test orders and user transactional data successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
