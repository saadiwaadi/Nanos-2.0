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
    const { trackingNumber, statusId, remarks } = body || {};

    if (!trackingNumber || typeof trackingNumber !== "string" || !trackingNumber.trim()) {
      return NextResponse.json(
        { error: "trackingNumber is required" },
        { status: 400 }
      );
    }

    const parsedStatusId = Number(statusId);
    if (parsedStatusId !== 1 && parsedStatusId !== 2) {
      return NextResponse.json(
        { error: "statusId must be 1 (Mark Return Requested) or 2 (Mark Retry Attempt)" },
        { status: 400 }
      );
    }

    if (!remarks || typeof remarks !== "string" || !remarks.trim()) {
      return NextResponse.json(
        { error: "remarks is required and cannot be empty" },
        { status: 400 }
      );
    }

    const res = await callSaveShipperAdviceApi({
      trackingNumber: trackingNumber.trim(),
      statusId: parsedStatusId as 1 | 2,
      remarks: remarks.trim(),
    });

    return NextResponse.json({ ok: true, message: "Shipper advice submitted to PostEx", data: res });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to submit shipper advice to PostEx" },
      { status: 500 }
    );
  }
}
