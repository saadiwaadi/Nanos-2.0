import { NextResponse } from "next/server";
import { TikTokEventsApiService, TikTokUserData, TikTokCustomProperties } from "@/lib/tiktok-events-api";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { eventName, eventId, userData, properties } = body || {};

    if (!eventName) {
      return NextResponse.json({ error: "Missing eventName" }, { status: 400 });
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    const clientUserAgent = request.headers.get("user-agent") || null;
    const eventSourceUrl =
      request.headers.get("referer") || "https://nanos.pk";

    const fullUserData: TikTokUserData = {
      ...(userData || {}),
      clientIp: (userData && userData.clientIp) || clientIp,
      clientUserAgent: (userData && userData.clientUserAgent) || clientUserAgent,
    };

    const finalEventId = eventId || crypto.randomUUID();

    await TikTokEventsApiService.sendEvent(
      eventName,
      finalEventId,
      eventSourceUrl,
      fullUserData,
      properties as TikTokCustomProperties
    );

    return NextResponse.json({ success: true, eventId: finalEventId });
  } catch (error: any) {
    console.error("TikTok track API route error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to forward TikTok event" },
      { status: 500 }
    );
  }
}
