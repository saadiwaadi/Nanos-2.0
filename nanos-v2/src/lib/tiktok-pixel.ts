export const TIKTOK_PIXEL_ID =
  process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || "DB57MQRC77U074LG2QGG";

export interface TikTokContentItem {
  content_id: string;
  content_type?: "product" | "product_group" | string;
  content_name?: string;
  quantity?: number;
  price?: number;
}

export interface TikTokEventParams {
  contents?: TikTokContentItem[];
  value?: number;
  currency?: string;
  search_string?: string;
  [key: string]: any;
}

export interface TikTokIdentifyData {
  email?: string;
  phone_number?: string;
  external_id?: string;
}

/**
 * Hash a string with SHA-256 using standard Web Crypto API
 */
export async function sha256(value: string): Promise<string> {
  if (typeof window === "undefined" || !value) return "";
  try {
    const trimmed = value.trim().toLowerCase();
    const msgUint8 = new TextEncoder().encode(trimmed);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (err) {
    console.warn("SHA-256 hash failed:", err);
    return "";
  }
}

/**
 * Identify user with client-side SHA-256 hashed PII before firing events
 */
export async function identifyTikTok(data: TikTokIdentifyData): Promise<void> {
  if (!TIKTOK_PIXEL_ID || typeof window === "undefined") return;
  const ttq = (window as any).ttq;
  if (!ttq || typeof ttq.identify !== "function") return;

  try {
    const payload: Record<string, string> = {};

    if (data.email && data.email.trim()) {
      const hashedEmail = await sha256(data.email);
      if (hashedEmail) payload.email = hashedEmail;
    }

    if (data.phone_number && data.phone_number.trim()) {
      // Normalize phone number: keep leading + if present, strip spaces/hyphens/dashes
      const cleanPhone = data.phone_number.replace(/[^\d+]/g, "");
      const hashedPhone = await sha256(cleanPhone);
      if (hashedPhone) payload.phone_number = hashedPhone;
    }

    if (data.external_id && data.external_id.trim()) {
      const hashedId = await sha256(data.external_id);
      if (hashedId) payload.external_id = hashedId;
    }

    if (Object.keys(payload).length > 0) {
      ttq.identify(payload);
    }
  } catch (err) {
    console.warn("TikTok Pixel identify error:", err);
  }
}

/**
 * Safe wrapper for ttq.track
 */
export function trackTikTok(
  eventName:
    | "ViewContent"
    | "AddToCart"
    | "AddToWishlist"
    | "Search"
    | "AddPaymentInfo"
    | "InitiateCheckout"
    | "PlaceAnOrder"
    | "CompleteRegistration"
    | "Purchase"
    | string,
  params: TikTokEventParams = {},
  eventId?: string
): void {
  if (!TIKTOK_PIXEL_ID || typeof window === "undefined") return;
  const ttq = (window as any).ttq;
  if (!ttq || typeof ttq.track !== "function") return;

  try {
    if (eventId) {
      ttq.track(eventName, params, { event_id: eventId });
    } else {
      ttq.track(eventName, params);
    }
  } catch (err) {
    console.warn(`TikTok Pixel [${eventName}] error:`, err);
  }
}

/**
 * Fire PageView
 */
export function tiktokPageView(): void {
  if (typeof window === "undefined") return;
  const ttq = (window as any).ttq;
  if (ttq && typeof ttq.page !== "function") return;

  try {
    ttq.page();
  } catch (err) {
    console.warn("TikTok Pixel pageview error:", err);
  }
}
