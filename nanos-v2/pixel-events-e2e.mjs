/**
 * Meta Pixel Events Probe Script (pixel-events-e2e.mjs)
 * Tests client-side fbq event tracking for:
 * 1. ViewContent (PDP)
 * 2. AddToCart (Cart action)
 * 3. Purchase (Order confirmation)
 */

// Simple node simulation to verify event generation & payload schemas
const capturedEvents = [];

// Mock window and fbq
global.window = {
  fbq: function (action, eventName, payload, options) {
    capturedEvents.push({ action, eventName, payload, options });
  }
};
global.window._fbq = global.window.fbq;

// Import our tracking helpers and simulation
import { trackMeta } from "./src/lib/fpixel.ts";

console.log("--- Starting Meta Pixel Event Verification ---");

// Test 1: ViewContent
const mockProduct = {
  id: "clog-black",
  name: "Everyday Comfort Clogs",
  category: "crocs",
  price: 1850
};

trackMeta("ViewContent", {
  content_ids: [mockProduct.id],
  content_type: "product",
  content_name: mockProduct.name,
  value: mockProduct.price,
  currency: "PKR"
}, "evt-viewcontent-123");

// Test 2: AddToCart
trackMeta("AddToCart", {
  content_ids: [mockProduct.id],
  content_type: "product",
  content_name: mockProduct.name,
  value: mockProduct.price * 2,
  currency: "PKR"
}, "evt-addtocart-456");

// Test 3: Purchase
const mockOrder = {
  id: "ord_test999",
  total: 3950,
  items: [
    { productId: "clog-black", quantity: 2, unitPrice: 1850 },
    { productId: "clog-sand", quantity: 1, unitPrice: 1650 }
  ]
};

trackMeta("Purchase", {
  content_ids: mockOrder.items.map(i => i.productId),
  content_type: "product",
  value: mockOrder.total,
  currency: "PKR"
}, mockOrder.id);

console.log("\nCaptured fbq Events:");
console.log(JSON.stringify(capturedEvents, null, 2));

const viewContent = capturedEvents.find(e => e.eventName === "ViewContent");
const addToCart = capturedEvents.find(e => e.eventName === "AddToCart");
const purchase = capturedEvents.find(e => e.eventName === "Purchase");

let allPassed = true;

if (!viewContent || !viewContent.payload.content_ids.includes("clog-black") || viewContent.payload.value !== 1850) {
  console.error("FAIL: ViewContent schema mismatch");
  allPassed = false;
} else {
  console.log("PASS: ViewContent verified");
}

if (!addToCart || !addToCart.payload.content_ids.includes("clog-black") || addToCart.payload.value !== 3700) {
  console.error("FAIL: AddToCart schema mismatch");
  allPassed = false;
} else {
  console.log("PASS: AddToCart verified");
}

if (!purchase || purchase.payload.content_ids.length !== 2 || purchase.payload.value !== 3950) {
  console.error("FAIL: Purchase schema mismatch");
  allPassed = false;
} else {
  console.log("PASS: Purchase verified");
}

if (allPassed) {
  console.log("\nALL META PIXEL EVENTS MATCH EXPECTED SCHEMA PERFECTLY.");
}
