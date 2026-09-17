"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, Suspense } from "react";

function ScrollRestorationInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fullPath = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  const isPopStateRef = useRef<boolean>(false);
  const scrollPositionsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (typeof window === "undefined" || pathname.startsWith("/admin")) return;

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const handlePopState = () => {
      isPopStateRef.current = true;
    };

    const handleScroll = () => {
      if (typeof window === "undefined" || pathname.startsWith("/admin")) return;
      const key = window.history.state?.key || fullPath;
      const y = window.scrollY;
      scrollPositionsRef.current.set(key, y);
      scrollPositionsRef.current.set(fullPath, y);
      try {
        sessionStorage.setItem(`scroll_pos_${key}`, String(y));
        sessionStorage.setItem(`scroll_pos_${fullPath}`, String(y));
      } catch {
        // Ignore quota error
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [pathname, fullPath]);

  useEffect(() => {
    if (typeof window === "undefined" || pathname.startsWith("/admin")) return;

    const key = window.history.state?.key || fullPath;

    if (isPopStateRef.current) {
      isPopStateRef.current = false;

      let savedY = scrollPositionsRef.current.get(key) ?? scrollPositionsRef.current.get(fullPath);
      if (savedY === undefined) {
        try {
          const storedKey = sessionStorage.getItem(`scroll_pos_${key}`);
          const storedPath = sessionStorage.getItem(`scroll_pos_${fullPath}`);
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
        requestAnimationFrame(() => {
          window.scrollTo({ top: targetY, behavior: "instant" as ScrollBehavior });
          setTimeout(() => {
            window.scrollTo({ top: targetY, behavior: "instant" as ScrollBehavior });
          }, 50);
          setTimeout(() => {
            window.scrollTo({ top: targetY, behavior: "instant" as ScrollBehavior });
          }, 150);
        });
      }
    } else {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
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
