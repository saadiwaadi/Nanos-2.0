import { canManual, canSystem, allowedNext } from "../src/lib/order-state";

async function runOrderManagementTests() {
  console.log("=========================================");
  console.log("        Order Management & Guard Tests  ");
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

  // --- Test 1: allowedNext helper ---
  console.log("--- Test 1: allowedNext helper ---");
  const placedNext = allowedNext("placed");
  assert(placedNext.includes("confirmed") && placedNext.includes("cancelled"), "placed allows confirmed & cancelled");

  const deadEndNext = allowedNext("delivered");
  assert(deadEndNext.length === 0, "delivered status returns empty allowedNext list (dead-end)");

  const cancelledNext = allowedNext("cancelled");
  assert(cancelledNext.length === 0, "cancelled status returns empty allowedNext list (dead-end)");

  const returnedNext = allowedNext("returned");
  assert(returnedNext.length === 0, "returned status returns empty allowedNext list (dead-end)");

  // --- Test 2: Transition guards ---
  console.log("\n--- Test 2: Transition rules ---");
  assert(!canManual("delivered", "placed"), "Manual transition delivered -> placed blocked");
  assert(!canSystem("cancelled", "shipped"), "System transition cancelled -> shipped blocked");

  console.log("\n=========================================");
  console.log(`Result: ${failCount === 0 ? "ALL TESTS PASSED" : `${failCount} TESTS FAILED`}`);
  console.log("=========================================");

  if (failCount > 0) process.exit(1);
}

runOrderManagementTests();
