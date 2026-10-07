import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { callTrackOrderApi, callSaveShipperAdviceApi } from "../src/lib/postex";

interface TestCandidate {
  orderId: string;
  ourOrderStatus: string;
  trackingNumber: string;
  postexStatus: string;
  historySummary?: string;
}

async function main() {
  console.log("================================================================================");
  console.log("              STEP 1: INVENTORY AVAILABLE TEST ORDERS BY STATUS                ");
  console.log("================================================================================");

  // Group by orderStatus with non-null tracking numbers in DB
  const dbGroups = await prisma.order.groupBy({
    by: ['orderStatus'],
    where: {
      OR: [
        { trackingNumber: { not: null } },
        { postexTrackingNumber: { not: null } },
      ],
    },
    _count: true,
  });

  console.log("Prisma groupBy orderStatus (where tracking is not null):");
  console.log(JSON.stringify(dbGroups, null, 2));

  const allTrackedOrders = await prisma.order.findMany({
    where: {
      OR: [
        { trackingNumber: { not: null } },
        { postexTrackingNumber: { not: null } },
      ],
    },
    select: {
      id: true,
      orderStatus: true,
      status: true,
      courierBookingStatus: true,
      trackingNumber: true,
      postexTrackingNumber: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Query live PostEx track status for all tracked orders
  console.log(`\nFetching PostEx live statuses for all ${allTrackedOrders.length} orders...`);
  const statusToCandidates: Record<string, TestCandidate[]> = {};

  for (const o of allTrackedOrders) {
    const tn = (o.trackingNumber || o.postexTrackingNumber || "").trim();
    if (!tn) continue;

    try {
      const track = await callTrackOrderApi(tn);
      const postexStatus = track?.dist?.transactionStatus || "UNKNOWN";
      const lastHistory = track?.dist?.transactionStatusHistory?.slice(-1)[0]?.transactionStatusMessage || "";

      const candidate: TestCandidate = {
        orderId: o.id,
        ourOrderStatus: o.orderStatus,
        trackingNumber: tn,
        postexStatus,
        historySummary: lastHistory,
      };

      if (!statusToCandidates[postexStatus]) {
        statusToCandidates[postexStatus] = [];
      }
      statusToCandidates[postexStatus].push(candidate);
    } catch (e: any) {
      console.error(`Failed to track ${tn}:`, e.message);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log("\n================================================================================");
  console.log("TEST CANDIDATES SELECTION (1 per distinct PostEx / DB status category)");
  console.log("================================================================================");

  const selectedCandidates: TestCandidate[] = [];

  // Order priority: Attempted, PostEx WareHouse, En-Route to Lahore warehouse, Booked, Delivered, Un-Assigned By Me
  const orderedStatuses = [
    "Attempted",
    "PostEx WareHouse",
    "En-Route to Lahore warehouse",
    "Booked",
    "Delivered",
    "Un-Assigned By Me",
  ];

  // Add any extra status found
  for (const st of Object.keys(statusToCandidates)) {
    if (!orderedStatuses.includes(st)) {
      orderedStatuses.push(st);
    }
  }

  for (const st of orderedStatuses) {
    const list = statusToCandidates[st];
    if (list && list.length > 0) {
      // Pick one representative
      const selected = list[0];
      selectedCandidates.push(selected);
      console.log(`- Status: "${st}" | Total Count in DB: ${list.length} | Selected Tracking: ${selected.trackingNumber} (Order ID: ${selected.orderId})`);
    }
  }

  console.log("\n================================================================================");
  console.log("STEP 2 & 3: EXECUTING CONTROLLED save-shipper-advice CALLS (statusId: 2)");
  console.log("================================================================================");

  const results: Array<{
    ourOrderStatus: string;
    trackingNumber: string;
    postexStatus: string;
    httpStatus: number | string;
    bodyStatusCode: string;
    bodyStatusMessage: string;
    rawResponse: any;
  }> = [];

  for (let i = 0; i < selectedCandidates.length; i++) {
    const cand = selectedCandidates[i];
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`[TEST ${i + 1}/${selectedCandidates.length}] Tracking: ${cand.trackingNumber} | DB: ${cand.ourOrderStatus} | PostEx: ${cand.postexStatus}`);
    console.log(`--------------------------------------------------------------------------------`);

    let httpStatus: number | string = 200;
    let bodyStatusCode = "";
    let bodyStatusMessage = "";
    let rawResponse: any = null;

    try {
      const resp = await callSaveShipperAdviceApi({
        trackingNumber: cand.trackingNumber,
        statusId: 2,
        remarks: "DIAG TEST STATUS CHECK - ignore",
      });
      rawResponse = resp;
      httpStatus = 200;
      bodyStatusCode = resp?.statusCode || "200";
      bodyStatusMessage = resp?.statusMessage || "SUCCESSFULLY OPERATED";
    } catch (err: any) {
      httpStatus = err.status || 200;
      if (err.responseBody) {
        rawResponse = err.responseBody;
        bodyStatusCode = err.responseBody.statusCode || "UNKNOWN";
        bodyStatusMessage = err.responseBody.statusMessage || err.message;
      } else {
        rawResponse = { error: err.message };
        bodyStatusCode = err.code || "ERR";
        bodyStatusMessage = err.message;
      }
    }

    results.push({
      ourOrderStatus: cand.ourOrderStatus,
      trackingNumber: cand.trackingNumber,
      postexStatus: cand.postexStatus,
      httpStatus,
      bodyStatusCode,
      bodyStatusMessage,
      rawResponse,
    });

    // Wait 2 seconds between calls to avoid rate limiting
    console.log("Waiting 2000ms before next test call...");
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log("\n================================================================================");
  console.log("FINAL RESULTS SUMMARY TABLES");
  console.log("================================================================================");

  console.log("\n--- STEP 2 TABLE: RAW SAVE-SHIPPER-ADVICE RESULTS ---");
  console.log("| our orderStatus | trackingNumber | PostEx HTTP status | PostEx body statusCode | PostEx statusMessage |");
  console.log("|---|---|---|---|---|");
  for (const r of results) {
    console.log(`| ${r.ourOrderStatus} | ${r.trackingNumber} | ${r.httpStatus} | ${r.bodyStatusCode} | ${r.bodyStatusMessage} |`);
  }

  console.log("\n--- STEP 3 TABLE: CROSS-CHECK WITH POSTEX TRANSACTION STATUS ---");
  console.log("| our orderStatus | trackingNumber | PostEx's own transactionStatus | save-shipper-advice result |");
  console.log("|---|---|---|---|");
  for (const r of results) {
    const outcome = (r.bodyStatusCode === "200" || r.bodyStatusMessage.includes("SUCCESS")) ? "SUCCESS" : `REJECTED (${r.bodyStatusCode}: ${r.bodyStatusMessage})`;
    console.log(`| ${r.ourOrderStatus} | ${r.trackingNumber} | ${r.postexStatus} | ${outcome} |`);
  }

  console.log("\n--- ALL CANDIDATES IN 'Attempted' STATUS ---");
  const attemptedList = statusToCandidates["Attempted"] || [];
  for (const att of attemptedList) {
    console.log(`Tracking: ${att.trackingNumber} | Last history: ${att.historySummary}`);
  }
}

main().catch(console.error);
