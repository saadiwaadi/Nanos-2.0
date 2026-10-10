import crypto from "crypto";

export interface TikTokUserData {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  external_id?: string | null;
  clientIp?: string | null;
  clientUserAgent?: string | null;
  ttp?: string | null;
  ttclid?: string | null;
}

export interface TikTokItemData {
  content_id: string;
  content_type?: string;
  content_name?: string;
  quantity?: number;
  price?: number;
}

export interface TikTokCustomProperties {
  contents?: TikTokItemData[];
  value?: number;
  currency?: string;
  search_string?: string;
  query?: string;
  description?: string;
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashField(val?: string | null): string | undefined {
  if (!val) return undefined;
  const cleaned = val.trim().toLowerCase();
  if (!cleaned) return undefined;
  return sha256(cleaned);
}

function formatPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("0")) {
    digits = "+92" + digits.slice(1);
  } else if (digits.startsWith("92")) {
    digits = "+" + digits;
  } else if (!digits.startsWith("+")) {
    digits = "+92" + digits;
  }
  return sha256(digits);
}

export class TikTokEventsApiService {
  static async sendEvent(
    eventName: string,
    eventId: string,
    eventSourceUrl: string,
    userData: TikTokUserData,
    properties?: TikTokCustomProperties
  ): Promise<void> {
    const pixelId =
      process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || "DB57MQRC77U074LG2QGG";
    const accessToken =
      process.env.TIKTOK_EVENTS_API_ACCESS_TOKEN ||
      process.env.TIKTOK_ACCESS_TOKEN;

    if (!pixelId || !accessToken) {
      return;
    }

    try {
      const hashedEmail = hashField(userData.email);
      const hashedPhone = formatPhone(userData.phone);
      const hashedExternalId = hashField(userData.external_id);

      const userPayload: Record<string, any> = {
        ip: userData.clientIp || undefined,
        user_agent: userData.clientUserAgent || undefined,
        ttp: userData.ttp || undefined,
        ttclid: userData.ttclid || undefined,
      };

      if (hashedEmail) userPayload.email = hashedEmail;
      if (hashedPhone) userPayload.phone = hashedPhone;
      if (hashedExternalId) userPayload.external_id = hashedExternalId;

      const eventItem: Record<string, any> = {
        event: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        user: userPayload,
        page: {
          url: eventSourceUrl,
        },
      };

      if (properties) {
        eventItem.properties = {
          currency: properties.currency || "PKR",
          value: properties.value,
          contents: properties.contents?.map((c) => ({
            content_id: c.content_id,
            content_type: c.content_type || "product",
            content_name: c.content_name,
            quantity: c.quantity || 1,
            price: c.price,
          })),
          search_string: properties.search_string,
          query: properties.query,
          description: properties.description,
        };
      }

      const body: Record<string, any> = {
        event_source: "web",
        event_source_id: pixelId,
        data: [eventItem],
      };

      if (process.env.TIKTOK_TEST_EVENT_CODE) {
        body.test_event_code = process.env.TIKTOK_TEST_EVENT_CODE;
      }

      const url = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Token": accessToken,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("TikTok Events API response error:", res.status, errText);
      }
    } catch (err: any) {
      console.error("TikTok Events API error:", err?.message || err);
    }
  }
}
