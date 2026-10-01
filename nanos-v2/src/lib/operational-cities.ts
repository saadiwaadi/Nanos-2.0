import { postexFetch } from "@/lib/postex-client";
import { PAKISTAN_CITIES } from "@/lib/cities";

// In-memory cache for operational cities (24 hours TTL)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedCities {
  at: number;
  cities: string[];
  citySet: Set<string>; // lowercased names for quick O(1) lookup
  cityMap: Map<string, string>; // lowercase -> canonical name
}

let memoryCache: CachedCities | null = null;

// Fallback curated list of Pakistan cities (excluding "Other")
const FALLBACK_CITIES: string[] = PAKISTAN_CITIES.filter(
  (c) => c && c.toLowerCase() !== "other"
).sort((a, b) => a.localeCompare(b));

/**
 * Fetches the list of operational delivery cities from PostEx with ~24h server-side caching.
 * Falls back safely if PostEx is unreachable or in mock/dev mode.
 */
export async function getOperationalCities(): Promise<string[]> {
  const now = Date.now();
  if (memoryCache && now - memoryCache.at < CACHE_TTL_MS && memoryCache.cities.length > 0) {
    return memoryCache.cities;
  }

  try {
    let r: any;
    try {
      r = await postexFetch("/order/v2/get-operational-city?operationalCityType=Delivery");
    } catch {
      try {
        r = await postexFetch("/order/v1/get-operational-city?operationalCityType=Delivery");
      } catch {
        r = await postexFetch("/order/v2/get-operational-city");
      }
    }

    const rawList = r?.dist || (Array.isArray(r) ? r : []);
    if (Array.isArray(rawList) && rawList.length > 0) {
      const distinctCities = new Set<string>();
      const cityMap = new Map<string, string>();
      const citySet = new Set<string>();

      for (const item of rawList) {
        const name = typeof item === "string" ? item : item?.operationalCityName || item?.cityName;
        if (name && typeof name === "string") {
          const trimmed = name.trim();
          if (trimmed.length > 0 && !distinctCities.has(trimmed)) {
            distinctCities.add(trimmed);
            citySet.add(trimmed.toLowerCase());
            cityMap.set(trimmed.toLowerCase(), trimmed);
          }
        }
      }

      const sorted = Array.from(distinctCities).sort((a, b) => a.localeCompare(b));

      if (sorted.length > 0) {
        memoryCache = {
          at: now,
          cities: sorted,
          citySet,
          cityMap,
        };
        return sorted;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch operational cities from PostEx, using fallback:", err);
  }

  // Fallback cache
  const citySet = new Set<string>();
  const cityMap = new Map<string, string>();
  for (const c of FALLBACK_CITIES) {
    citySet.add(c.toLowerCase());
    cityMap.set(c.toLowerCase(), c);
  }

  memoryCache = {
    at: now,
    cities: FALLBACK_CITIES,
    citySet,
    cityMap,
  };

  return FALLBACK_CITIES;
}

/**
 * Validates whether a city name exactly matches one of the operational cities (case-insensitive).
 */
export async function isValidOperationalCity(cityName: string): Promise<boolean> {
  if (!cityName || typeof cityName !== "string") return false;
  await getOperationalCities();
  if (!memoryCache) return false;
  return memoryCache.citySet.has(cityName.trim().toLowerCase());
}

/**
 * Returns canonical casing for a given operational city name, or null if invalid.
 */
export async function normalizeOperationalCity(cityName: string): Promise<string | null> {
  if (!cityName || typeof cityName !== "string") return null;
  await getOperationalCities();
  if (!memoryCache) return null;
  return memoryCache.cityMap.get(cityName.trim().toLowerCase()) || null;
}
