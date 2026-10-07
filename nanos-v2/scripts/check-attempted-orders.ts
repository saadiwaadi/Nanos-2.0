import "dotenv/config";
import { callTrackOrderApi, callSaveShipperAdviceApi } from "../src/lib/postex";

async function main() {
  const attemptedTrackings = ["26122580000046", "21122580000045", "21122580000042"];

  for (const tn of attemptedTrackings) {
    console.log(`\n=================== Tracking ${tn} ===================`);
    const track = await callTrackOrderApi(tn);
    console.log("Full Track dist:", JSON.stringify(track.dist, null, 2));
    
    try {
      const resp = await callSaveShipperAdviceApi({
        trackingNumber: tn,
        statusId: 2,
        remarks: "DIAG TEST STATUS CHECK - ignore",
      });
      console.log("Advice result:", resp);
    } catch (err: any) {
      console.log("Advice error:", err.message, err.responseBody);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

main().catch(console.error);
