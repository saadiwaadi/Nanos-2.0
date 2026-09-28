import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth-server";
import { getAccountSummary } from "@/lib/account-summary";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authPayload = await verifyToken(request);
    const userId = authPayload?.sub || null;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summary = await getAccountSummary(userId);
    return NextResponse.json(summary);
  } catch (error: any) {
    console.error("Failed to fetch account summary:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load account summary." },
      { status: 500 }
    );
  }
}
