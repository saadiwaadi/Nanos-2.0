"use client";

import { useEffect, useState, Suspense } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { META_PIXEL_ID, isTrackingEnvironment, shouldSuppressPixel, trackMeta } from "@/lib/fpixel";
import { useAuth } from "@/lib/auth";

function MetaPixelNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!META_PIXEL_ID || !isTrackingEnvironment()) return;
    if (shouldSuppressPixel(pathname, searchParams)) return;
    trackMeta("PageView");
  }, [pathname, searchParams]);

  return null;
}

function MetaPixelInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [isAllowedHost, setIsAllowedHost] = useState(false);

  useEffect(() => {
    setIsAllowedHost(isTrackingEnvironment());
  }, []);

  useEffect(() => {
    if (!META_PIXEL_ID || !isAllowedHost) return;
    if (!user?.email) return;

    const w = window as any;
    if (typeof w !== "undefined" && typeof w.fbq === "function") {
      w.fbq("init", META_PIXEL_ID, {
        em: user.email,
        ph: (user as any).phone || undefined,
      });
    }
  }, [user, scriptLoaded, isAllowedHost]);

  if (!META_PIXEL_ID || !isAllowedHost || shouldSuppressPixel(pathname, searchParams)) {
    return null;
  }

  return (
    <>
      <Script
        id="fb-pixel"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL_ID}');
            fbq('set', 'autoConfig', false, '${META_PIXEL_ID}');
          `,
        }}
      />
      <noscript style={{ display: "none" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
      <MetaPixelNavigation />
    </>
  );
}

export function MetaPixel() {
  return (
    <Suspense fallback={null}>
      <MetaPixelInner />
    </Suspense>
  );
}

