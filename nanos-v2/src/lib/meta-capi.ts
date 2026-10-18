import crypto from "crypto";

export interface CapiUserData {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  city?: string | null;
  country?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  clientIp?: string | null;
  clientUserAgent?: string | null;
}

export interface CapiCustomData {
  value?: number;
  currency?: string;
  content_type?: string;
  content_ids?: string[];
  contents?: Array<{ id: string; quantity: number; item_price?: number }>;
  num_items?: number;
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
    digits = "92" + digits.slice(1);
  } else if (!digits.startsWith("92")) {
    digits = "92" + digits;
  }
  return sha256(digits);
}

function splitName(fullName?: string | null): { firstName?: string; lastName?: string } {
  if (!fullName) return {};
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { firstName: hashField(parts[0]) };
  const firstName = hashField(parts[0]);
  const lastName = hashField(parts.slice(1).join(" "));
  return { firstName, lastName };
}

export class MetaCapiService {
  static async sendEvent(
    eventName: string,
    eventId: string,
    eventSourceUrl: string,
    userData: CapiUserData,
    customData?: CapiCustomData,
    testEventCode?: string
  ): Promise<any> {
    const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
    const accessToken = process.env.META_CAPI_ACCESS_TOKEN;

    if (!pixelId || !accessToken) {
      console.warn("[Meta CAPI] Missing NEXT_PUBLIC_META_PIXEL_ID or META_CAPI_ACCESS_TOKEN");
      return;
    }

    const effectiveTestEventCode =
      testEventCode ||
      (customData as any)?.test_event_code ||
      process.env.META_TEST_EVENT_CODE;

    if (process.env.NODE_ENV !== "production") {
      if (!effectiveTestEventCode) {
        console.log(
          `[Meta CAPI] Skipping ${eventName} in non-production mode (NODE_ENV=${process.env.NODE_ENV}). Set META_TEST_EVENT_CODE to test.`
        );
        return;
      }
      console.log(
        `[Meta CAPI] Non-production mode: sending ${eventName} tagged with test_event_code: ${effectiveTestEventCode}`
      );
    }

    const rawValue = customData?.value;
    let numericValue: number | undefined = undefined;
    if (typeof rawValue === "number" && !isNaN(rawValue)) {
      numericValue = rawValue;
    } else if (typeof rawValue === "string" && !isNaN(parseFloat(rawValue))) {
      numericValue = parseFloat(rawValue);
    }

    if (eventName === "Purchase") {
      const isValidPositiveValue =
        numericValue !== undefined &&
        numericValue !== null &&
        !isNaN(numericValue) &&
        numericValue > 0;

      if (!isValidPositiveValue || !customData?.currency) {
        console.error(
          "[Meta CAPI] ERROR: Purchase event skipped - missing, invalid, or non-positive value",
          {
            event_id: eventId,
            order_id: (customData as any)?.order_id || eventId,
            value: rawValue,
            currency: customData?.currency || "PKR",
          }
        );
        return {
          ok: false,
          skipped: true,
          reason: !isValidPositiveValue
            ? "missing_or_non_positive_value"
            : "missing_currency",
          status: 400,
          error: `Purchase event skipped: ${
            !isValidPositiveValue
              ? `value must be a valid positive number (received ${rawValue})`
              : "currency is required"
          }`,
        };
      }
    }

    try {
      const { firstName, lastName } = splitName(userData.name);
      const hashedEmail = hashField(userData.email);
      const hashedPhone = formatPhone(userData.phone);
      const hashedCity = hashField(userData.city);
      const hashedCountry = hashField(userData.country || "pk");

      const payloadUserData: Record<string, any> = {
        client_ip_address: userData.clientIp || undefined,
        client_user_agent: userData.clientUserAgent || undefined,
        fbp: userData.fbp || undefined,
        fbc: userData.fbc || undefined,
      };

      if (hashedEmail) payloadUserData.em = [hashedEmail];
      if (hashedPhone) payloadUserData.ph = [hashedPhone];
      if (firstName) payloadUserData.fn = [firstName];
      if (lastName) payloadUserData.ln = [lastName];
      if (hashedCity) payloadUserData.ct = [hashedCity];
      if (hashedCountry) payloadUserData.country = [hashedCountry];

      const eventItem: Record<string, any> = {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: eventSourceUrl,
        action_source: "website",
        user_data: payloadUserData,
        custom_data: {
          value: numericValue,
          currency: customData?.currency || "PKR",
          content_type: customData?.content_type || "product",
          content_ids: customData?.content_ids,
          contents: customData?.contents,
          num_items: customData?.num_items,
        },
      };

      const body: Record<string, any> = {
        data: [eventItem],
      };

      if (effectiveTestEventCode) {
        body.test_event_code = effectiveTestEventCode;
      }

      const graphVersion = process.env.META_GRAPH_VERSION || "v22.0";
      const url = `https://graph.facebook.com/${graphVersion}/${pixelId}/events?access_token=${accessToken}`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(4000),
      });

      const resText = await res.text();
      let resJson: any;
      try {
        resJson = JSON.parse(resText);
      } catch {
        resJson = resText;
      }

      if (!res.ok) {
        console.error("Meta CAPI response error:", res.status, resText);
      } else if (effectiveTestEventCode || process.env.NODE_ENV !== "production") {
        console.log(`[Meta CAPI] Response status: ${res.status}`);
        console.log(`[Meta CAPI] Response body:`, JSON.stringify(resJson, null, 2));
      }

      return { ok: res.ok, status: res.status, body: resJson };
    } catch (err: any) {
      console.error("Meta CAPI error:", err?.message || err);
      return { ok: false, status: 0, error: err?.message || err };
    }
  }
}
