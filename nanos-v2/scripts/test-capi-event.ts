import "dotenv/config";
import { MetaCapiService, CapiUserData, CapiCustomData } from "../src/lib/meta-capi";

async function main() {
  console.log("==================================================");
  console.log("      Meta CAPI Standalone Purchase Test Event    ");
  console.log("==================================================");

  const eventName = "Purchase";
  const eventId = "manual_test_" + Date.now();
  const eventTime = Math.floor(Date.now() / 1000);
  const actionSource = "website";
  const eventSourceUrl = "https://nanos.pk/checkout";
  const testEventCode = "TEST39025";

  // Ensure test event code is also available in env as fallback
  process.env.META_TEST_EVENT_CODE = testEventCode;

  const userData: CapiUserData = {
    email: "test.customer@nanos.pk",
    phone: "03001234567",
    name: "Test Customer",
    city: "Lahore",
    country: "pk",
    clientIp: "127.0.0.1",
    clientUserAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };

  const testMissingValue = process.argv.includes("--missing-value");

  const customData: CapiCustomData = {
    ...(testMissingValue ? {} : { value: 100 }),
    currency: "PKR",
    content_type: "product",
    content_ids: ["test_sku_100"],
    contents: [
      {
        id: "test_sku_100",
        quantity: 1,
        item_price: 100,
      },
    ],
    num_items: 1,
  };

  console.log("Event Details:");
  console.log("  Event Name:       ", eventName);
  console.log("  Event ID:         ", eventId);
  console.log("  Event Time:       ", eventTime);
  console.log("  Action Source:    ", actionSource);
  console.log("  Event Source URL: ", eventSourceUrl);
  console.log("  Custom Data:      ", JSON.stringify(customData));
  console.log("  Test Event Code:  ", testEventCode);
  console.log("  Target Pixel ID:  ", process.env.NEXT_PUBLIC_META_PIXEL_ID);
  if (testMissingValue) {
    console.log("  [TEST MODE] Deliberately testing missing value behavior");
  }
  console.log("--------------------------------------------------\n");

  console.log("Calling MetaCapiService.sendEvent with explicit test_event_code...\n");

  const result = await MetaCapiService.sendEvent(
    eventName,
    eventId,
    eventSourceUrl,
    userData,
    customData,
    testEventCode
  );

  console.log("\n==================================================");
  console.log("                 Result Summary                   ");
  console.log("==================================================");
  console.log("HTTP Status Code:", result?.status ?? "N/A");
  console.log("Meta Response / Result Details:\n", JSON.stringify(result?.body ?? result, null, 2));

  if (result?.skipped) {
    console.log("\n>>> EVENT WAS SKIPPED (not sent to Meta):", result.reason, "<<<");
  } else if (result?.ok) {
    console.log("\n>>> SUCCESS: Event was accepted by Meta Graph API! <<<");
  } else {
    console.error("\n>>> FAILURE: Event was rejected or failed to send! <<<");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Fatal error during test script execution:", err);
  process.exit(1);
});
