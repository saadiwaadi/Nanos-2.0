"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// In-memory cache map for instantaneous synchronous lookups
const memoryCache = new Map<string, CacheEntry<any>>();

// Map to deduplicate concurrent in-flight fetch requests for the same key
const inFlightRequests = new Map<string, Promise<any>>();

// Session storage key prefix for cross-page navigation persistence
const STORAGE_PREFIX = "nanos_swr_";

// Default freshness window: 60 seconds (data is considered stale after 60s)
export const DEFAULT_STALE_TIME = 60 * 1000;

/**
 * Retrieve cached entry from memory or sessionStorage synchronously
 */
export function getCachedData<T>(key: string): CacheEntry<T> | null {
  if (!key) return null;

  // 1. In-memory check (fastest)
  if (memoryCache.has(key)) {
    return memoryCache.get(key) as CacheEntry<T>;
  }

  // 2. SessionStorage check (persists within user browser session)
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (raw) {
        const parsed: CacheEntry<T> = JSON.parse(raw);
        // Sync back into memoryCache
        memoryCache.set(key, parsed);
        return parsed;
      }
    } catch {
      // Storage unavailable or disabled
    }
  }

  return null;
}

/**
 * Store data into in-memory cache and sessionStorage
 */
export function setCachedData<T>(key: string, data: T, timestamp: number = Date.now()): void {
  if (!key) return;

  const entry: CacheEntry<T> = { data, timestamp };
  memoryCache.set(key, entry);

  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(entry));
    } catch {
      // Ignore quota exceeded or storage disabled
    }
  }
}

/**
 * Remove an entry or clear all SWR cache entries
 */
export function clearCachedData(key?: string): void {
  if (key) {
    memoryCache.delete(key);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      } catch {
        // Ignore
      }
    }
  } else {
    memoryCache.clear();
    if (typeof window !== "undefined") {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k && k.startsWith(STORAGE_PREFIX)) {
            keysToRemove.push(k);
          }
        }
        for (const k of keysToRemove) {
          sessionStorage.removeItem(k);
        }
      } catch {
        // Ignore
      }
    }
  }
}

/**
 * Check if a timestamp is older than maxAgeMs (default 60 seconds)
 */
export function isCacheStale(timestamp: number, maxAgeMs: number = DEFAULT_STALE_TIME): boolean {
  return Date.now() - timestamp > maxAgeMs;
}

/**
 * Deep structural comparison to avoid unnecessary React re-renders and UI flashes
 * when background revalidation returns identical data.
 */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
}

export interface UseSWROptions<T> {
  initialData?: T;
  staleTime?: number; // freshness in ms (defaults to 60,000ms / 60s)
  revalidateOnFocus?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: any) => void;
}

export interface UseSWRResult<T> {
  data: T | null;
  isLoading: boolean;
  isValidating: boolean;
  error: any;
  mutate: (newData?: T | Promise<T>, shouldRevalidate?: boolean) => Promise<T | null>;
  revalidate: () => Promise<T | null>;
}

/**
 * SWR Hook implementing Stale-While-Revalidate pattern:
 * - If cached data exists: renders immediately with no skeleton / spinner.
 * - If data is stale (> 60s): quietly refetches in the background.
 * - If new data differs: smoothly updates state without layout jumps or skeletons reappearing.
 * - If background refetch fails: quietly keeps showing cached data and logs error.
 * - If no cache exists: falls back to loading skeleton state.
 */
export function useSWR<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: UseSWROptions<T> = {}
): UseSWRResult<T> {
  const {
    initialData,
    staleTime = DEFAULT_STALE_TIME,
    revalidateOnFocus = false,
  } = options;

  // Synchronous cache lookup during initial render
  const cachedEntry = key ? getCachedData<T>(key) : null;

  const [data, setData] = useState<T | null>(() => {
    if (cachedEntry) return cachedEntry.data;
    if (initialData !== undefined) return initialData;
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (cachedEntry || initialData !== undefined) return false;
    return key !== null;
  });

  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [error, setError] = useState<any>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const dataRef = useRef(data);
  dataRef.current = data;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Prime cache with initialData if cache was empty
  useEffect(() => {
    if (key && initialData !== undefined && !getCachedData(key)) {
      setCachedData(key, initialData);
    }
  }, [key, initialData]);

  // Background revalidation logic
  const revalidate = useCallback(async (): Promise<T | null> => {
    if (!key) return null;

    setIsValidating(true);

    try {
      // Deduplicate in-flight requests
      let requestPromise = inFlightRequests.get(key);
      if (!requestPromise) {
        requestPromise = fetcherRef.current().finally(() => {
          inFlightRequests.delete(key);
        });
        inFlightRequests.set(key, requestPromise);
      }

      const freshData = await requestPromise;

      // Only update state if data has changed to prevent unnecessary re-renders
      if (!deepEqual(dataRef.current, freshData)) {
        setData(freshData);
      }

      // Always update cache and fresh timestamp
      setCachedData(key, freshData);
      setError(null);
      setIsLoading(false);
      optionsRef.current.onSuccess?.(freshData);
      return freshData;
    } catch (err) {
      // Quietly log background refetch errors without interrupting visible UI
      console.warn(`[SWR] Background revalidation failed for "${key}":`, err);

      // Only expose error state if no data exists at all (first-ever load failure)
      if (dataRef.current === null) {
        setError(err);
      }
      // If we already have cached data, NEVER block or hide visible content!

      optionsRef.current.onError?.(err);
      setIsLoading(false);
      return null;
    } finally {
      setIsValidating(false);
    }
  }, [key]);

  // Manual mutate function
  const mutate = useCallback(
    async (newData?: T | Promise<T>, shouldRevalidate: boolean = true): Promise<T | null> => {
      if (!key) return null;
      if (newData !== undefined) {
        const resolved = await newData;
        setData(resolved);
        setCachedData(key, resolved);
      }
      if (shouldRevalidate) {
        return revalidate();
      }
      return dataRef.current;
    },
    [key, revalidate]
  );

  // Trigger SWR evaluation
  useEffect(() => {
    if (!key) return;

    const currentCached = getCachedData<T>(key);

    if (currentCached) {
      // Sync state if cached data changed
      if (!deepEqual(dataRef.current, currentCached.data)) {
        setData(currentCached.data);
      }
      setIsLoading(false);

      // Revalidate in background if cache is older than staleTime (60s)
      if (isCacheStale(currentCached.timestamp, staleTime)) {
        revalidate();
      }
    } else if (initialData !== undefined) {
      setCachedData(key, initialData);
      setData(initialData);
      setIsLoading(false);
    } else {
      // First-ever visit with no cache
      setIsLoading(true);
      revalidate();
    }
  }, [key, staleTime, initialData, revalidate]);

  // Window focus revalidation
  useEffect(() => {
    if (!revalidateOnFocus || !key) return;

    const onFocus = () => {
      const current = getCachedData<T>(key);
      if (!current || isCacheStale(current.timestamp, staleTime)) {
        revalidate();
      }
    };

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [key, revalidateOnFocus, staleTime, revalidate]);

  return {
    data,
    isLoading,
    isValidating,
    error,
    mutate,
    revalidate,
  };
}
