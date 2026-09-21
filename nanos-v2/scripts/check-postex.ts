import "dotenv/config";
import { POSTEX_BASE_URL, POSTEX_API_TOKEN } from "../src/lib/postex";
import { prisma } from "../src/lib/prisma";

const PICKUP_ADDRESS_CODE = process.env.POSTEX_PICKUP_ADDRESS_CODE || "001";

async function main() {
  let hasFailure = false;

  console.log("=========================================");
  console.log("      PostEx Connectivity Check         ");
  console.log("=========================================");
  console.log(`Base URL: ${POSTEX_BASE_URL}`);
  if (!POSTEX_API_TOKEN) {
    console.log("[WARN] POSTEX_API_TOKEN is empty or not set in environment.");
  } else {
    console.log("API Token: [CONFIGURED - HIDDEN]");
  }

  // 1. Call get-operational-city
  console.log("\n--- Check 1: Operational Cities API (get-operational-city) ---");
  let operationalCities: string[] = [];
  try {
    const cityUrl = `${POSTEX_BASE_URL}/services/integration/api/order/v1/get-operational-city`;
    const res = await fetch(cityUrl, {
      method: "GET",
      headers: {
        token: POSTEX_API_TOKEN,
        "Content-Type": "application/json",
      },
    });

    console.log(`HTTP Status: ${res.status}`);

    if (!res.ok) {
      console.log(`[FAIL] get-operational-city HTTP status is ${res.status}`);
      hasFailure = true;
    } else {
      const data = await res.json();
      const rawList = Array.isArray(data?.dist)
        ? data.dist
        : Array.isArray(data)
        ? data
        : [];

      operationalCities = rawList
        .map((item: any) =>
          typeof item === "string"
            ? item
            : item?.cityName || item?.name || item?.cityNameEng || item?.operationalCityName || item?.title || ""
        )
        .filter(Boolean);


      console.log(`Cities Returned Count: ${operationalCities.length}`);

      if (operationalCities.length > 0) {
        console.log(`[PASS] Successfully retrieved ${operationalCities.length} operational cities.`);
      } else {
        console.log(`[FAIL] get-operational-city returned 0 cities or unexpected format.`);
        hasFailure = true;
      }
    }
  } catch (err: any) {
    console.log(`[FAIL] Failed to execute get-operational-city fetch: ${err.message}`);
    hasFailure = true;
  }

  // 2. Call get-merchant-address
  console.log("\n--- Check 2: Merchant Addresses API (get-merchant-address) ---");
  let merchantAddressCodes: string[] = [];
  try {
    const addressUrl = `${POSTEX_BASE_URL}/services/integration/api/order/v1/get-merchant-address`;
    const res = await fetch(addressUrl, {
      method: "GET",
      headers: {
        token: POSTEX_API_TOKEN,
        "Content-Type": "application/json",
      },
    });

    console.log(`HTTP Status: ${res.status}`);

    if (!res.ok) {
      console.log(`[FAIL] get-merchant-address HTTP status is ${res.status}`);
      hasFailure = true;
    } else {
      const data = await res.json();
      const rawList = Array.isArray(data?.dist)
        ? data.dist
        : Array.isArray(data)
        ? data
        : [];

      merchantAddressCodes = rawList
        .map((item: any) =>
          typeof item === "string"
            ? item
            : item?.pickupAddressCode || item?.addressCode || item?.code || ""
        )
        .filter(Boolean);

      console.log(`Merchant Addresses Count: ${merchantAddressCodes.length}`);
      console.log(`Address Codes: ${merchantAddressCodes.length > 0 ? merchantAddressCodes.join(", ") : "(none)"}`);

      if (merchantAddressCodes.length > 0) {
        console.log(`[PASS] Successfully retrieved ${merchantAddressCodes.length} merchant address codes.`);
      } else {
        console.log(`[FAIL] get-merchant-address returned 0 address codes.`);
        hasFailure = true;
      }
    }
  } catch (err: any) {
    console.log(`[FAIL] Failed to execute get-merchant-address fetch: ${err.message}`);
    hasFailure = true;
  }

  // 3. Confirm pickup address code in env matches one returned by PostEx
  console.log("\n--- Check 3: Pickup Address Code Verification ---");
  console.log(`Configured Pickup Address Code: ${PICKUP_ADDRESS_CODE}`);
  if (merchantAddressCodes.includes(PICKUP_ADDRESS_CODE)) {
    console.log(`[PASS] Configured pickup address code "${PICKUP_ADDRESS_CODE}" matches a valid PostEx merchant address.`);
  } else {
    console.log(
      `[FAIL] Configured pickup address code "${PICKUP_ADDRESS_CODE}" was not found in returned merchant address codes: [${merchantAddressCodes.join(
        ", "
      )}]`
    );
    hasFailure = true;
  }

  // 4. Confirm supported delivery cities appear in returned city list
  console.log("\n--- Check 4: Delivery Cities Support Verification ---");
  const defaultSupported = ["Lahore", "Karachi", "Islamabad", "Gujrat"];
  let dbCitiesList: string[] = [];
  try {
    const dbCities = await prisma.postexAutoBookCity.findMany({ where: { enabled: true } });
    dbCitiesList = dbCities.map((c) => c.cityName);
  } catch {
    // Fallback if DB table not available
  }

  const supportedCities = Array.from(new Set([...defaultSupported, ...dbCitiesList]));
  console.log(`Supported delivery cities to verify: ${supportedCities.join(", ")}`);

  const lowerOpCities = operationalCities.map((c) => c.trim().toLowerCase());
  const missingCities: string[] = [];

  for (const city of supportedCities) {
    const found = lowerOpCities.includes(city.trim().toLowerCase());
    if (found) {
      console.log(`  ✓ ${city}: Found in PostEx operational cities list.`);
    } else {
      console.log(`  ✗ ${city}: NOT found in PostEx operational cities list.`);
      missingCities.push(city);
    }
  }

  if (missingCities.length === 0) {
    console.log(`[PASS] All supported delivery cities are present in PostEx operational city list.`);
  } else {
    console.log(`[FAIL] Missing supported cities in PostEx list: ${missingCities.join(", ")}`);
    hasFailure = true;
  }

  console.log("\n=========================================");
  if (hasFailure) {
    console.log("Overall Result: FAIL");
    process.exit(1);
  } else {
    console.log("Overall Result: PASS");
    process.exit(0);
  }
}

main()
  .catch((err) => {
    console.error("Fatal error running check-postex:", err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect().catch(() => {});
  });
