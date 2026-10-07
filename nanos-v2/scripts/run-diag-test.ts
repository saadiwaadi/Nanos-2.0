import "dotenv/config";
import { callSaveShipperAdviceApi, callGetShipperAdviceApi } from "../src/lib/postex";

async function main() {
  const trackingNumber = "21122580000039";
  const statusId = 2 as const;
  const remarks = "DIAG TEST - ignore";

  console.log("=========================================");
  console.log("       STEP 2: CONTROLLED LIVE TEST      ");
  console.log("=========================================");

  let step2Success = false;
  let step2Response: any = null;

  try {
    step2Response = await callSaveShipperAdviceApi({
      trackingNumber,
      statusId,
      remarks,
    });
    console.log("[POSTEX_DIAG] Step 2 Result Object:", JSON.stringify(step2Response));
    if (step2Response?.statusCode === "200" && step2Response?.statusMessage === "SUCCESSFULLY OPERATED") {
      step2Success = true;
    }
  } catch (err: any) {
    console.log("[POSTEX_DIAG] Step 2 Threw Exception:", err.message);
  }

  if (!step2Success) {
    console.log("\n=========================================");
    console.log("       STEP 3: GET SHIPPER ADVICE        ");
    console.log("=========================================");
    try {
      const step3Response = await callGetShipperAdviceApi(trackingNumber);
      console.log("[POSTEX_DIAG] Step 3 Result Object:", JSON.stringify(step3Response));
    } catch (err: any) {
      console.log("[POSTEX_DIAG] Step 3 Threw Exception:", err.message);
    }
  }
}

main().catch(console.error);
