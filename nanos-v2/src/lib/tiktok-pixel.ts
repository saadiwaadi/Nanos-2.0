import { Market, getClientMarket } from "@/lib/market";

export const TIKTOK_PIXEL_ID_PK =
  process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID_PK ||
  process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID ||
  "DB57MQRC77U074LG2QGG";

export const TIKTOK_PIXEL_ID_USA =
  process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID_USA || "DB8HK0BC77UB6E0EAN70";

// Backwards-compatible alias (defaults to PK pixel)
export const TIKTOK_PIXEL_ID = TIKTOK_PIXEL_ID_PK;

/**
 * Returns the active TikTok Pixel ID for the current visitor's market
 */
export function getActiveTikTokPixelId(marketOverride?: Market): string {
  const market = marketOverride || getClientMarket();
  if (market === "USA") {
    // If USA pixel ID is set, use it. If not set yet (placeholder), fall back to PK pixel.
    return TIKTOK_PIXEL_ID_USA || TIKTOK_PIXEL_ID_PK;
  }
  return TIKTOK_PIXEL_ID_PK;
}

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
 * Identify user with client-side SHA-256 hashed PII before firing events.
 * Scoped to the active market pixel instance.
 */
export async function identifyTikTok(
  data: TikTokIdentifyData,
  marketOverride?: Market
): Promise<void> {
  const activePixelId = getActiveTikTokPixelId(marketOverride);
  if (!activePixelId || typeof window === "undefined") return;
  const ttq = (window as any).ttq;
  if (!ttq) return;

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
      const instance = typeof ttq.instance === "function" ? ttq.instance(activePixelId) : null;
      const target = instance && typeof instance.identify === "function" ? instance : ttq;
      if (typeof target.identify === "function") {
        target.identify(payload);
      }
    }
  } catch (err) {
    console.warn("TikTok Pixel identify error:", err);
  }
}

/**
 * Safe wrapper for ttq.track — routes ONLY to the active market pixel instance
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
    | "CompletePayment"
    | "CompleteRegistration"
    | "Purchase"
    | string,
  params: TikTokEventParams = {},
  eventId?: string,
  marketOverride?: Market
): void {
  const activePixelId = getActiveTikTokPixelId(marketOverride);
  if (!activePixelId || typeof window === "undefined") return;
  const ttq = (window as any).ttq;
  if (!ttq) return;

  try {
    const currentMarket = marketOverride || getClientMarket();
    const resolvedParams: TikTokEventParams = { ...params };
    if (currentMarket === "USA" && (!resolvedParams.currency || resolvedParams.currency === "PKR")) {
      resolvedParams.currency = "USD";
    }

    const instance = typeof ttq.instance === "function" ? ttq.instance(activePixelId) : null;
    const target = instance && typeof instance.track === "function" ? instance : ttq;

    if (typeof target.track !== "function") return;

    if (eventId) {
      target.track(eventName, resolvedParams, { event_id: eventId });
    } else {
      target.track(eventName, resolvedParams);
    }
  } catch (err) {
    console.warn(`TikTok Pixel [${eventName}] error:`, err);
  }
}

/**
 * Fire PageView for active market pixel
 */
export function tiktokPageView(marketOverride?: Market): void {
  if (typeof window === "undefined") return;
  const activePixelId = getActiveTikTokPixelId(marketOverride);
  if (!activePixelId) return;
  const ttq = (window as any).ttq;
  if (!ttq) return;

  try {
    const instance = typeof ttq.instance === "function" ? ttq.instance(activePixelId) : null;
    const target = instance && typeof instance.page === "function" ? instance : ttq;
    if (typeof target.page === "function") {
      target.page();
    }
  } catch (err) {
    console.warn("TikTok Pixel pageview error:", err);
  }
}
