import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import {
  getShippingSettings,
  saveShippingSettings,
  ShippingSettings,
} from "@/lib/shipping-settings";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  try {
    const settings = await getShippingSettings();
    return NextResponse.json(settings);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch delivery settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  try {
    const body = await request.json();
    const current = await getShippingSettings();

    const updated: ShippingSettings = {
      standardDeliveryFee:
        typeof body.standardDeliveryFee === "number"
          ? Math.max(0, Math.round(body.standardDeliveryFee))
          : current.standardDeliveryFee,
      freeDeliveryThreshold:
        typeof body.freeDeliveryThreshold === "number"
          ? Math.max(0, Math.round(body.freeDeliveryThreshold))
          : current.freeDeliveryThreshold,
      enabled: typeof body.enabled === "boolean" ? body.enabled : current.enabled,
    };

    const saved = await saveShippingSettings(updated);
    return NextResponse.json({ success: true, settings: saved });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update delivery settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return PUT(request);
}
