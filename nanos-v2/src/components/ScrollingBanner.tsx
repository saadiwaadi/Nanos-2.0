"use client";

import React from "react";
import { ScrollingBannerConfig } from "@/lib/homepage";

interface ScrollingBannerProps {
  config?: ScrollingBannerConfig;
}

const DEFAULT_ITEMS = [
  "EVERYDAY",
  "CUSHIONED",
  "ANTI-SLIP",
  "LIGHTWEIGHT",
  "ADJUSTABLE",
  "BREATHABLE",
  "ALL-DAY COMFORT",
  "PREMIUM FINISH",
];

export function ScrollingBanner({ config }: ScrollingBannerProps) {
  if (config?.isHidden) return null;

  const rawItems = config?.items && config.items.length > 0 ? config.items : DEFAULT_ITEMS;
  const separator = config?.separator || "✦";
  const speed = config?.speedSeconds || 48;
  const bgStyle = config?.bgStyle || "off-white";

  // Build a repeated list for seamless infinite looping
  const repeatedItems = [...rawItems, ...rawItems, ...rawItems, ...rawItems];

  return (
    <div
      className={`scrolling-marquee-container marquee-bg-${bgStyle}`}
      style={{
        width: "100%",
        overflow: "hidden",
        position: "relative",
        userSelect: "none",
      }}
      role="region"
      aria-label="Features banner"
    >
      <div
        className="scrolling-marquee-track"
        style={{
          display: "flex",
          alignItems: "center",
          width: "max-content",
          animationDuration: `${speed}s`,
        }}
      >
        {/* Track 1 */}
        <div className="scrolling-marquee-content" style={{ display: "flex", alignItems: "center" }}>
          {repeatedItems.map((item, idx) => (
            <React.Fragment key={`t1-${idx}`}>
              <span className="marquee-item-text">{item}</span>
              <span className="marquee-item-separator" aria-hidden="true">
                {separator}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* Track 2 (Duplicate for seamless continuous loop) */}
        <div className="scrolling-marquee-content" aria-hidden="true" style={{ display: "flex", alignItems: "center" }}>
          {repeatedItems.map((item, idx) => (
            <React.Fragment key={`t2-${idx}`}>
              <span className="marquee-item-text">{item}</span>
              <span className="marquee-item-separator" aria-hidden="true">
                {separator}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
