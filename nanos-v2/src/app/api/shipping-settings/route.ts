import { NextResponse } from "next/server";
import { getShippingSettings } from "@/lib/shipping-settings";

export async function GET() {
  try {
    const settings = await getShippingSettings();
    return NextResponse.json(settings);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch shipping settings" },
      { status: 500 }
    );
  }
}
