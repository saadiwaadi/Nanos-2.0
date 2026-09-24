import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import {
  getPromoSettings,
  savePromoSettings,
  PromoSettings,
} from "@/lib/promo-settings";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  try {
    const settings = await getPromoSettings();
    return NextResponse.json(settings);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch promo settings" },
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
    const current = await getPromoSettings();

    const updated: PromoSettings = {
      code: typeof body.code === "string" ? body.code.trim().toUpperCase() : current.code,
      discountType: body.discountType === "fixed" ? "fixed" : "percent",
      discountValue: typeof body.discountValue === "number" ? body.discountValue : current.discountValue,
      minOrderAmount: typeof body.minOrderAmount === "number" ? body.minOrderAmount : current.minOrderAmount,
      enabled: typeof body.enabled === "boolean" ? body.enabled : current.enabled,
      description: typeof body.description === "string" ? body.description : current.description,
    };

    const saved = await savePromoSettings(updated);
    return NextResponse.json({ success: true, settings: saved });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update promo settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return PUT(request);
}
