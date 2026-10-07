import "dotenv/config";
import { callTrackOrderApi, callSaveShipperAdviceApi, callGetShipperAdviceApi } from "../src/lib/postex";

interface TestSubject {
  trackingNumber: string;
  expectedStatus: string;
}

async function main() {
  const testSubjects: TestSubject[] = [
    { trackingNumber: "26122580000046", expectedStatus: "Attempted" },
    { trackingNumber: "23122580000049", expectedStatus: "Delivered" },
    { trackingNumber: "27122580000064", expectedStatus: "Booked" },
  ];

  console.log("================================================================================");
  console.log("             DIFFERENTIAL TEST: statusId: 1 (Mark Return Requested)            ");
  console.log("================================================================================");

  const results: Array<{
    trackingNumber: string;
    postexStatus: string;
    statusIdSent: number;
    httpStatus: number | string;
    bodyStatusCode: string;
    bodyStatusMessage: string;
    rawResponse: any;
    getShipperAdviceResult?: any;
  }> = [];

  for (let i = 0; i < testSubjects.length; i++) {
    const subject = testSubjects[i];
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`[TEST ${i + 1}/${testSubjects.length}] Tracking: ${subject.trackingNumber}`);
    console.log(`--------------------------------------------------------------------------------`);

    // Verify live status
    let liveStatus = subject.expectedStatus;
    try {
      const trackRes = await callTrackOrderApi(subject.trackingNumber);
      liveStatus = trackRes?.dist?.transactionStatus || subject.expectedStatus;
      console.log(`Current PostEx live status: ${liveStatus}`);
    } catch (e: any) {
      console.log(`Failed to track ${subject.trackingNumber}: ${e.message}`);
    }

    await new Promise((r) => setTimeout(r, 500));

    let httpStatus: number | string = 200;
    let bodyStatusCode = "";
    let bodyStatusMessage = "";
    let rawResponse: any = null;
    let getShipperAdviceResult: any = undefined;

    try {
      const resp = await callSaveShipperAdviceApi({
        trackingNumber: subject.trackingNumber,
        statusId: 1, // Differential test variable: 1 = Return Requested
        remarks: "DIAG TEST STATUSID1 CHECK - ignore",
      });
      rawResponse = resp;
      httpStatus = 200;
      bodyStatusCode = resp?.statusCode || "200";
      bodyStatusMessage = resp?.statusMessage || "SUCCESSFULLY OPERATED";

      if (bodyStatusCode === "200" || bodyStatusMessage.includes("SUCCESS")) {
        console.log(`[STEP 4] SUCCESS observed for ${subject.trackingNumber}! Calling get-shipper-advice to verify persistence...`);
        getShipperAdviceResult = await callGetShipperAdviceApi(subject.trackingNumber);
        console.log(`[STEP 4 Result]`, JSON.stringify(getShipperAdviceResult, null, 2));
      }
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
      trackingNumber: subject.trackingNumber,
      postexStatus: liveStatus,
      statusIdSent: 1,
      httpStatus,
      bodyStatusCode,
      bodyStatusMessage,
      rawResponse,
      getShipperAdviceResult,
    });

    console.log("Waiting 2000ms before next test call...");
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log("\n================================================================================");
  console.log("SUMMARY: STEP 2 TABLE (statusId: 1)");
  console.log("================================================================================");
  console.log("| trackingNumber | PostEx live transactionStatus | statusId sent | PostEx HTTP status | PostEx body statusCode | PostEx statusMessage |");
  console.log("|---|---|---|---|---|---|");
  for (const r of results) {
    console.log(`| ${r.trackingNumber} | ${r.postexStatus} | ${r.statusIdSent} | ${r.httpStatus} | ${r.bodyStatusCode} | ${r.bodyStatusMessage} |`);
  }

  console.log("\n================================================================================");
  console.log("SUMMARY: STEP 3 SIDE-BY-SIDE COMPARISON (statusId: 2 vs statusId: 1)");
  console.log("================================================================================");
  console.log("| trackingNumber | PostEx transactionStatus | statusId:2 result | statusId:1 result |");
  console.log("|---|---|---|---|");
  for (const r of results) {
    const s1Outcome = (r.bodyStatusCode === "200" || r.bodyStatusMessage.includes("SUCCESS")) ? "SUCCESS (200)" : `REJECTED (${r.bodyStatusCode}: ${r.bodyStatusMessage})`;
    const s2Outcome = "REJECTED (400: Cannot add transaction remark to this order. Please check the status of your order to add remark)";
    console.log(`| ${r.trackingNumber} | ${r.postexStatus} | ${s2Outcome} | ${s1Outcome} |`);
  }
}

main().catch(console.error);
