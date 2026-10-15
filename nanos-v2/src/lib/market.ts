export type Market = "PK" | "USA";

export const DEFAULT_MARKET: Market = "PK";

export const MARKET_STORAGE_KEY = "nanos_market";
export const MARKET_COOKIE_KEY = "nanos_market";

/**
 * Detect client-side market:
 * 1. URL search params (?market=us, ?country=us, ?region=us, ?tt_country=us)
 * 2. Cookie / localStorage ('nanos_market')
 * 3. Browser timezone heuristic (e.g. America/* -> USA)
 * 4. Fallback: DEFAULT_MARKET ("PK")
 *
 * NOTE ON FALLBACK CHOICE:
 * If no market indicator is found (no US query param, no cookie, no US timezone),
 * the system deliberately falls back to "PK" (Pakistan) to preserve existing
 * default behavior for Nanos PK traffic.
 */
export function getClientMarket(): Market {
  if (typeof window === "undefined") {
    return DEFAULT_MARKET;
  }

  try {
    // 1. URL query check (e.g. ad campaign link or test link)
    const urlParams = new URLSearchParams(window.location.search);
    const queryMarket =
      urlParams.get("market") ||
      urlParams.get("country") ||
      urlParams.get("region") ||
      urlParams.get("tt_country") ||
      urlParams.get("pixel") ||
      urlParams.get("tt_pixel");

    if (queryMarket) {
      const q = queryMarket.trim().toUpperCase();
      if (q === "US" || q === "USA") {
        setClientMarket("USA");
        return "USA";
      }
      if (q === "PK" || q === "PAK" || q === "PAKISTAN") {
        setClientMarket("PK");
        return "PK";
      }
    }

    // 2. LocalStorage & Cookie check
    const stored = window.localStorage.getItem(MARKET_STORAGE_KEY);
    if (stored === "USA" || stored === "PK") {
      return stored as Market;
    }

    const matchCookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${MARKET_COOKIE_KEY}=`));
    if (matchCookie) {
      const cookieVal = matchCookie.split("=")[1]?.toUpperCase();
      if (cookieVal === "USA" || cookieVal === "PK") {
        return cookieVal as Market;
      }
    }

    // 3. Timezone heuristic for US visitors
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (
      timeZone.startsWith("America/") ||
      timeZone.startsWith("US/") ||
      timeZone === "Pacific/Honolulu"
    ) {
      return "USA";
    }
  } catch {
    // Fall back to default on error
  }

  // 4. Fallback choice: Pakistan
  return DEFAULT_MARKET;
}

export function setClientMarket(market: Market): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MARKET_STORAGE_KEY, market);
    document.cookie = `${MARKET_COOKIE_KEY}=${market}; path=/; max-age=2592000; SameSite=Lax`;
  } catch {}
}

/**
 * Server-side market detection from headers, shipping info, or phone.
 *
 * NOTE ON FALLBACK CHOICE:
 * If incoming request headers (x-vercel-ip-country, cf-ipcountry, etc.)
 * or customer data do not indicate US, it defaults to "PK".
 */
export function getServerMarket(
  headers?: Headers | Record<string, string | null | undefined> | null,
  countryHint?: string | null,
  phoneHint?: string | null,
  explicitMarket?: string | null
): Market {
  if (explicitMarket) {
    const norm = explicitMarket.trim().toUpperCase();
    if (norm === "USA" || norm === "US") return "USA";
    if (norm === "PK") return "PK";
  }

  if (countryHint) {
    const c = countryHint.trim().toUpperCase();
    if (c === "US" || c === "USA" || c === "UNITED STATES") return "USA";
    if (c === "PK" || c === "PAK" || c === "PAKISTAN") return "PK";
  }

  if (phoneHint) {
    const cleanPhone = phoneHint.trim().replace(/[^\d+]/g, "");
    if (cleanPhone.startsWith("+1") || (cleanPhone.startsWith("1") && cleanPhone.length === 11)) {
      return "USA";
    }
    if (cleanPhone.startsWith("+92") || cleanPhone.startsWith("03") || cleanPhone.startsWith("92")) {
      return "PK";
    }
  }

  if (headers) {
    const getHeader = (name: string): string | null => {
      if (typeof (headers as Headers).get === "function") {
        return (headers as Headers).get(name);
      }
      return (headers as Record<string, string | null | undefined>)[name] || null;
    };

    const geoCountry = (
      getHeader("x-vercel-ip-country") ||
      getHeader("cf-ipcountry") ||
      getHeader("x-country-code") ||
      getHeader("cloudfront-viewer-country") ||
      ""
    )
      .trim()
      .toUpperCase();

    if (geoCountry === "US" || geoCountry === "USA") {
      return "USA";
    }
    if (geoCountry === "PK") {
      return "PK";
    }

    // Cookie fallback in headers
    const cookieHeader = getHeader("cookie");
    if (cookieHeader) {
      if (cookieHeader.includes("nanos_market=USA")) return "USA";
      if (cookieHeader.includes("nanos_market=PK")) return "PK";
    }
  }

  // Fallback choice: Pakistan
  return DEFAULT_MARKET;
}
