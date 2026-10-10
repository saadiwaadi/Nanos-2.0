export const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID || "969572164409296";

/**
 * Checks if the current pathname or search parameters contain paths or tokens
 * where Meta Pixel tracking must be disabled (admin, login, account, token URLs).
 */
export function shouldSuppressPixel(
  pathname: string,
  searchParams?: { toString: () => string } | null
): boolean {
  if (!pathname) return false;

  const lowerPath = pathname.toLowerCase();
  if (
    lowerPath.startsWith("/admin") ||
    lowerPath.startsWith("/login") ||
    lowerPath.startsWith("/account") ||
    lowerPath.includes("token")
  ) {
    return true;
  }

  if (searchParams) {
    const paramsStr = searchParams.toString().toLowerCase();
    if (paramsStr.includes("token")) {
      return true;
    }
  }

  return false;
}

/**
 * Route every event through one safe, typed helper.
 * Safe when fbq is loaded, loading, or NEXT_PUBLIC_META_PIXEL_ID is unset.
 */
export function trackMeta(
  eventName: string,
  params: Record<string, any> = {},
  eventId?: string
): void {
  if (typeof window === "undefined" || !META_PIXEL_ID) return;

  const w = window as any;
  if (!w.fbq) {
    w.fbq = function () {
      if (w.fbq.callMethod) {
        w.fbq.callMethod.apply(w.fbq, arguments);
      } else {
        w.fbq.queue.push(arguments);
      }
    };
    if (!w._fbq) w._fbq = w.fbq;
    w.fbq.push = w.fbq;
    w.fbq.loaded = true;
    w.fbq.version = "2.0";
    w.fbq.queue = w.fbq.queue || [];
  }

  try {
    if (eventId) {
      w.fbq("track", eventName, params, { eventID: eventId });
    } else {
      w.fbq("track", eventName, params);
    }
  } catch (err) {
    console.warn("Meta Pixel track error:", err);
  }
}

// Backwards compatibility wrappers
export const pageview = () => trackMeta("PageView");
export const event = (name: string, options: Record<string, any> = {}) =>
  trackMeta(name, options);

