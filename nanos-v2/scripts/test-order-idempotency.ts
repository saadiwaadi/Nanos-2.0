import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import crypto from "crypto";

async function run() {
  console.log("==================================================");
  console.log("       Order Creation Idempotency Test            ");
  console.log("==================================================");

  const testKey = "test_idem_" + crypto.randomUUID();
  console.log("Testing with idempotencyKey:", testKey);

  // Clean up any test order with this key just in case (safe-delete)
  await prisma.order.deleteMany({
    where: { idempotencyKey: testKey },
  });

  // Fetch a product to test with
  const product = await prisma.product.findFirst({
    include: { stockLevels: true },
  });

  if (!product) {
    throw new Error("No products found in DB for testing");
  }

  const payload = {
    items: [
      {
        productId: product.id,
        name: product.name,
        color: product.stockLevels[0]?.color || "Standard",
        size: product.stockLevels[0]?.size || "Standard",
        quantity: 1,
        price: product.price,
      },
    ],
    shippingInfo: {
      name: "Idempotency Test User",
      phone: "03001234567",
      email: "idem.test@nanos.pk",
      address: "123 Test Street",
      city: "Lahore",
    },
    idempotencyKey: testKey,
  };

  // Import the route handler directly to simulate POST /api/orders
  const { POST } = await import("../src/app/api/orders/route");

  console.log("\n--- Step 1: First request with idempotencyKey ---");
  const req1 = new Request("http://localhost:3000/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify(payload),
  });

  const res1 = await POST(req1);
  const data1 = await res1.json();
  console.log("Response 1 status:", res1.status);
  console.log("Response 1 data:", data1);

  if (res1.status !== 201 || !data1.id) {
    throw new Error(`First request failed: status ${res1.status}`);
  }

  const firstOrderId = data1.id;

  console.log("\n--- Step 2: Second request with IDENTICAL idempotencyKey ---");
  const req2 = new Request("http://localhost:3000/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify(payload),
  });

  const res2 = await POST(req2);
  const data2 = await res2.json();
  console.log("Response 2 status:", res2.status);
  console.log("Response 2 data:", data2);

  if (res2.status !== 200) {
    throw new Error(`Second request should return 200 OK for idempotent return, got ${res2.status}`);
  }

  if (data2.id !== firstOrderId) {
    throw new Error(`Second request returned different orderId (${data2.id}) instead of deduplicating to ${firstOrderId}`);
  }

  console.log("\n>>> PASS: Idempotency deduplication returned the exact same order without duplicates! <<<");

  // Verify only 1 order exists in database with this key
  const countInDb = await prisma.order.count({
    where: { idempotencyKey: testKey },
  });
  console.log("Count in DB with this key:", countInDb);
  if (countInDb !== 1) {
    throw new Error(`Expected exactly 1 order in DB, found ${countInDb}`);
  }

  // Cleanup test order
  console.log("\n--- Cleaning up test order ---");
  await prisma.orderItem.deleteMany({ where: { orderId: firstOrderId } });
  await prisma.orderEvent.deleteMany({ where: { orderId: firstOrderId } });
  await prisma.order.delete({ where: { id: firstOrderId } });
  console.log("Test order cleaned up successfully.");

  console.log("\n==================================================");
  console.log("      ALL IDEMPOTENCY TESTS PASSED!               ");
  console.log("==================================================");
}

run()
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
