import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { callSaveShipperAdviceApi, callGetShipperAdviceApi } from "@/lib/postex";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const { searchParams } = new URL(request.url);
  const trackingNumber = searchParams.get("trackingNumber");

  if (!trackingNumber) {
    return NextResponse.json(
      { error: "trackingNumber query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const data = await callGetShipperAdviceApi(trackingNumber);
    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch shipper advice from PostEx" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  try {
    const body = await request.json();
    const { trackingNumber, statusId = 0, remarks } = body || {};

    if (!trackingNumber || !remarks) {
      return NextResponse.json(
        { error: "trackingNumber and remarks are required" },
        { status: 400 }
      );
    }

    const res = await callSaveShipperAdviceApi({
      trackingNumber,
      statusId: Number(statusId) || 0,
      remarks: String(remarks).trim(),
    });

    return NextResponse.json({ ok: true, message: "Shipper advice submitted to PostEx", data: res });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to submit shipper advice to PostEx" },
      { status: 500 }
    );
  }
}
