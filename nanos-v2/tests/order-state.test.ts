import "dotenv/config";
import {
  ORDER_STATUSES,
  allowedNext,
  canManual,
  canSystem,
  mapCourierStatus,
} from "../src/lib/order-state";

async function runTests() {
  console.log("=========================================");
  console.log("   Order State & Courier Status Tests    ");
  console.log("=========================================");

  let failed = false;

  const assert = (condition: boolean, msg: string) => {
    if (condition) {
      console.log(`  ✓ [PASS] ${msg}`);
    } else {
      console.log(`  ✗ [FAIL] ${msg}`);
      failed = true;
    }
  };

  // 1. Test mapCourierStatus with PostEx status strings
  console.log("\n--- Test 1: mapCourierStatus resolution ---");
  const testCases: Array<{ raw: string; expected: string | null }> = [
    { raw: "Delivered", expected: "delivered" },
    { raw: "DELIVERED", expected: "delivered" },
    { raw: "Un-Delivered", expected: null },
    { raw: "Not Delivered", expected: null },
    { raw: "Picked", expected: "shipped" },
    { raw: "In Transit", expected: "shipped" },
    { raw: "Out for Delivery", expected: "shipped" },
    { raw: "Warehouse", expected: "shipped" },
    { raw: "Returned", expected: "returned" },
    { raw: "Returned to Origin", expected: "returned" },
    { raw: "Out for Return", expected: "shipped" },
    { raw: "Return in Process", expected: "shipped" },
    { raw: "Booked", expected: null },
    { raw: "UnBooked", expected: null },
    { raw: "Random Unknown Status", expected: null },
  ];

  for (const tc of testCases) {
    const res = mapCourierStatus(tc.raw);
    if (res !== tc.expected) {
      console.log(`  [LOG] Unknown/Unmapped courier status: "${tc.raw}" -> ${res}`);
    }
    assert(
      res === tc.expected,
      `mapCourierStatus("${tc.raw}") => ${res} (expected ${tc.expected})`
    );
  }

  // 2. Test Manual & System Transition rules
  console.log("\n--- Test 2: Transition rules ---");
  assert(canManual("placed", "confirmed") === true, "Manual: placed -> confirmed allowed");
  assert(canManual("placed", "delivered") === false, "Manual: placed -> delivered invalid");
  assert(canManual("shipped", "delivered") === true, "Manual: shipped -> delivered allowed");
  assert(canManual("cancelled", "placed") === false, "Manual: cancelled -> placed invalid");

  assert(canSystem("placed", "shipped") === true, "System: placed -> shipped allowed");
  assert(canSystem("placed", "delivered") === true, "System: placed -> delivered allowed");
  assert(canSystem("cancelled", "delivered") === false, "System: cancelled -> delivered invalid");

  console.log("\n=========================================");
  if (failed) {
    console.log("Result: TESTS FAILED");
    process.exit(1);
  } else {
    console.log("Result: ALL TESTS PASSED");
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
