import { isAvailable, reserveStock, releaseStock } from "../src/lib/stock";
import { AppError } from "../src/lib/order-state";

async function runStockTests() {
  console.log("=========================================");
  console.log("         Stock Management Tests          ");
  console.log("=========================================\n");

  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✓ [PASS] ${desc}`);
      passCount++;
    } else {
      console.error(`  ✗ [FAIL] ${desc}`);
      failCount++;
    }
  }

  // --- Test 1: isAvailable helper ---
  console.log("--- Test 1: isAvailable helper ---");
  assert(isAvailable({ ignoreStock: false }, { stock: 5, ignoreStock: false }), "Stock > 0 is available");
  assert(!isAvailable({ ignoreStock: false }, { stock: 0, ignoreStock: false }), "Stock === 0 is unavailable");
  assert(isAvailable({ ignoreStock: true }, { stock: 0, ignoreStock: false }), "Product ignoreStock=true makes 0 stock available");
  assert(isAvailable({ ignoreStock: false }, { stock: 0, ignoreStock: true }), "Variant ignoreStock=true makes 0 stock available");

  // --- Test 2: Mock Transaction Context for reserveStock ---
  console.log("\n--- Test 2: reserveStock logic ---");

  let mockStock = 1;
  const mockTx: any = {
    product: {
      findUnique: async () => ({ ignoreStock: false }),
    },
    stockLevel: {
      findFirst: async () => ({ id: "sl_123", quantity: mockStock }),
      updateMany: async (args: any) => {
        if (args.where.quantity.gte <= mockStock) {
          mockStock -= args.where.quantity.gte;
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
  };

  // First order takes last unit
  try {
    const tracked = await reserveStock(mockTx, [
      { productId: "p1", color: "Black", size: "UK 7", qty: 1 },
    ]);
    assert(tracked["p1:Black:UK 7"] === true, "First order reserves last unit successfully");
  } catch (e: any) {
    assert(false, `First order failed unexpectedly: ${e.message}`);
  }

  // Second order attempts to take unit (stock now 0)
  try {
    await reserveStock(mockTx, [
      { productId: "p1", color: "Black", size: "UK 7", qty: 1 },
    ]);
    assert(false, "Second order should have failed with OUT_OF_STOCK");
  } catch (e: any) {
    assert(e instanceof AppError && e.code === "OUT_OF_STOCK", "Second order produced 409 OUT_OF_STOCK shortage");
  }

  // --- Test 3: Restocking with releaseStock ---
  console.log("\n--- Test 3: releaseStock logic ---");
  let incrementedCount = 0;
  const mockReleaseTx: any = {
    stockLevel: {
      updateMany: async (args: any) => {
        incrementedCount += args.data.quantity.increment;
        return { count: 1 };
      },
    },
  };

  await releaseStock(mockReleaseTx, [
    { productId: "p1", color: "Black", size: "UK 7", qty: 1, stockTracked: true },
    { productId: "p1", color: "Black", size: "UK 8", qty: 1, stockTracked: false },
  ]);

  assert(incrementedCount === 1, "releaseStock incremented only tracked item");

  console.log("\n=========================================");
  console.log(`Result: ${failCount === 0 ? "ALL TESTS PASSED" : `${failCount} TESTS FAILED`}`);
  console.log("=========================================");

  if (failCount > 0) process.exit(1);
}

runStockTests();
