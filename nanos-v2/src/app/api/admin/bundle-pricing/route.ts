import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import {
  getBundlePricingSettings,
  saveBundlePricingSettings,
  BundlePricingSettings,
} from "@/lib/bundle-pricing";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    const status = auth.error === "403" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  try {
    const settings = await getBundlePricingSettings();
    return NextResponse.json(settings);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch bundle pricing settings" },
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
    const current = await getBundlePricingSettings();

    const updated: BundlePricingSettings = {
      defaultBuy2DiscountPercent:
        typeof body.defaultBuy2DiscountPercent === "number"
          ? body.defaultBuy2DiscountPercent
          : current.defaultBuy2DiscountPercent,
      defaultBuy3DiscountPercent:
        typeof body.defaultBuy3DiscountPercent === "number"
          ? body.defaultBuy3DiscountPercent
          : current.defaultBuy3DiscountPercent,
      products: {
        ...current.products,
        ...(body.products || {}),
      },
    };

    if (body.productId && body.override) {
      updated.products[body.productId] = body.override;
    }

    const saved = await saveBundlePricingSettings(updated);
    return NextResponse.json({ success: true, settings: saved });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update bundle pricing settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return PUT(request);
}
