"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, Suspense } from "react";

function ScrollRestorationInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchStr = searchParams.toString();
  const fullPath = `${pathname}${searchStr ? `?${searchStr}` : ""}`;

  const isPopStateRef = useRef<boolean>(false);
  const scrollPositionsRef = useRef<Map<string, number>>(new Map());
  const activeRestorationTimerRef = useRef<number | null>(null);

  // 1. Record scroll position during user scrolling
  useEffect(() => {
    if (typeof window === "undefined" || pathname.startsWith("/admin")) return;

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const handlePopState = () => {
      isPopStateRef.current = true;
    };

    const recordCurrentScroll = () => {
      if (typeof window === "undefined" || pathname.startsWith("/admin")) return;
      const y = window.scrollY;
      const key = window.history.state?.key || window.history.state?.__NAVI_KEY__ || fullPath;
      
      scrollPositionsRef.current.set(key, y);
      scrollPositionsRef.current.set(fullPath, y);
      try {
        sessionStorage.setItem(`nanos_scroll_${key}`, String(y));
        sessionStorage.setItem(`nanos_scroll_${fullPath}`, String(y));
      } catch {
        // Ignore quota limits
      }
    };

    let scrollTimeout: NodeJS.Timeout | null = null;
    const handleScroll = () => {
      recordCurrentScroll();
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(recordCurrentScroll, 100);
    };

    const handleClick = (e: MouseEvent) => {
      // If clicking an anchor tag, save current scroll right before navigation
      const target = (e.target as HTMLElement)?.closest("a");
      if (target && target.href) {
        recordCurrentScroll();
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("beforeunload", recordCurrentScroll);

    return () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("beforeunload", recordCurrentScroll);
    };
  }, [pathname, fullPath]);

  // 2. Restore scroll position on route changes
  useEffect(() => {
    if (typeof window === "undefined" || pathname.startsWith("/admin")) return;

    if (activeRestorationTimerRef.current) {
      cancelAnimationFrame(activeRestorationTimerRef.current);
      activeRestorationTimerRef.current = null;
    }

    const key = window.history.state?.key || window.history.state?.__NAVI_KEY__ || fullPath;

    if (isPopStateRef.current) {
      isPopStateRef.current = false;

      // Look up saved scroll position from memory or sessionStorage
      let savedY = scrollPositionsRef.current.get(key) ?? scrollPositionsRef.current.get(fullPath);
      if (savedY === undefined) {
        try {
          const storedKey = sessionStorage.getItem(`nanos_scroll_${key}`);
          const storedPath = sessionStorage.getItem(`nanos_scroll_${fullPath}`);
          const stored = storedKey ?? storedPath;
          if (stored !== null) {
            savedY = parseFloat(stored);
          }
        } catch {
          // Ignore
        }
      }

      if (savedY !== undefined && savedY > 0) {
        const targetY = savedY;
        const startTime = performance.now();
        const MAX_RESTORATION_MS = 1200;

        const attemptRestore = () => {
          const maxScroll = Math.max(
            0,
            document.documentElement.scrollHeight - window.innerHeight
          );

          if (maxScroll >= targetY) {
            window.scrollTo({ top: targetY, behavior: "instant" as ScrollBehavior });
          } else if (maxScroll > 0) {
            window.scrollTo({ top: maxScroll, behavior: "instant" as ScrollBehavior });
          }

          if (performance.now() - startTime < MAX_RESTORATION_MS) {
            activeRestorationTimerRef.current = requestAnimationFrame(attemptRestore);
          } else {
            // Final snap once time expires
            window.scrollTo({ top: targetY, behavior: "instant" as ScrollBehavior });
            activeRestorationTimerRef.current = null;
          }
        };

        // Cancel active restoration loop if user manually touches/scrolls
        const stopRestorationOnUserInteraction = () => {
          if (activeRestorationTimerRef.current) {
            cancelAnimationFrame(activeRestorationTimerRef.current);
            activeRestorationTimerRef.current = null;
          }
          window.removeEventListener("wheel", stopRestorationOnUserInteraction);
          window.removeEventListener("touchstart", stopRestorationOnUserInteraction);
        };

        window.addEventListener("wheel", stopRestorationOnUserInteraction, { passive: true, once: true });
        window.addEventListener("touchstart", stopRestorationOnUserInteraction, { passive: true, once: true });

        activeRestorationTimerRef.current = requestAnimationFrame(attemptRestore);
      }
    } else {
      // Forward link navigation to new page -> start at top
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }

    return () => {
      if (activeRestorationTimerRef.current) {
        cancelAnimationFrame(activeRestorationTimerRef.current);
        activeRestorationTimerRef.current = null;
      }
    };
  }, [fullPath, pathname]);

  return null;
}

export function ScrollRestoration() {
  return (
    <Suspense fallback={null}>
      <ScrollRestorationInner />
    </Suspense>
  );
}

export default ScrollRestoration;
