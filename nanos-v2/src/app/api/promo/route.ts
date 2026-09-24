import { NextResponse } from "next/server";
import { getPromoSettings, validatePromoCode } from "@/lib/promo-settings";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const subtotal = Number(searchParams.get("subtotal")) || 0;

    const settings = await getPromoSettings();

    if (!code) {
      // Return public promo config
      return NextResponse.json({
        enabled: settings.enabled,
        code: settings.enabled ? settings.code : null,
        discountType: settings.discountType,
        discountValue: settings.discountValue,
        minOrderAmount: settings.minOrderAmount,
      });
    }

    const result = validatePromoCode(code, subtotal, settings);
    return NextResponse.json({
      ...result,
      code: settings.code,
      discountType: settings.discountType,
      discountValue: settings.discountValue,
    });
  } catch (err: any) {
    return NextResponse.json(
      { valid: false, discount: 0, message: err.message || "Validation failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = typeof body.code === "string" ? body.code : "";
    const subtotal = Number(body.subtotal) || 0;

    const settings = await getPromoSettings();
    const result = validatePromoCode(code, subtotal, settings);

    return NextResponse.json({
      ...result,
      code: settings.code,
      discountType: settings.discountType,
      discountValue: settings.discountValue,
    });
  } catch (err: any) {
    return NextResponse.json(
      { valid: false, discount: 0, message: err.message || "Validation failed" },
      { status: 500 }
    );
  }
}
