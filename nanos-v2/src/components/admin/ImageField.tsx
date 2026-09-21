"use client";

import { useEffect, useState } from "react";

export const IMAGE_SPECS = {
  productMain: {
    label: "Main image",
    w: 1200,
    h: 1200,
    note: "Square 1:1. Product centred with ~8% padding. JPG/WebP under 400 KB.",
  },
  productGallery: {
    label: "Gallery image",
    w: 1200,
    h: 1200,
    note: "Square 1:1. Same style as the main image.",
  },
  productColor: {
    label: "Color image",
    w: 1200,
    h: 1200,
    note: "Square 1:1. One per color.",
  },
  categoryTile: {
    label: "Category tile",
    w: 1600,
    h: 1000,
    note: "16:10. Keep the subject away from the bottom-left label.",
  },
  promoTile: {
    label: "Promo tile",
    w: 1200,
    h: 900,
    note: "4:3.",
  },
  heroDesktop: {
    label: "Hero (desktop)",
    w: 2400,
    h: 1350,
    note: "16:9. Keep the left 45% calm for the text.",
  },
  heroMobile: {
    label: "Hero (mobile)",
    w: 1080,
    h: 1350,
    note: "4:5. Subject centred.",
  },
} as const;

export type ImageSpec = (typeof IMAGE_SPECS)[keyof typeof IMAGE_SPECS];

type S = {
  st: "empty" | "loading" | "ok" | "warn" | "error";
  msg?: string;
  w?: number;
  h?: number;
};

export function ImageField({
  value,
  onChange,
  spec,
  compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  spec: ImageSpec;
  compact?: boolean;
}) {
  const [s, setS] = useState<S>({ st: "empty" });

  useEffect(() => {
    if (!value || !value.trim()) {
      setS({ st: "empty" });
      return;
    }

    setS({ st: "loading" });
    let stale = false;
    const img = new window.Image();

    img.onload = () => {
      if (stale) return;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const want = spec.w / spec.h;
      const ratioOff = Math.abs(w / h - want) / want > 0.05;
      const small = w < spec.w * 0.75;

      let hostMsg = "";
      try {
        const u = new URL(value.trim());
        const allowedHosts = [
          "images.unsplash.com",
          "via.placeholder.com",
          "postex.pk",
          "cdn.shopify.com",
          "res.cloudinary.com",
          "i.ibb.co",
          "nanos.pk",
          "localhost",
        ];
        if (!allowedHosts.some((h) => u.hostname.includes(h))) {
          hostMsg = `Host "${u.hostname}" isn't in allowed list — storefront may fail`;
        }
      } catch {
        // invalid URL
      }

      const msgs = [
        ratioOff &&
          `Ratio is ${(w / h).toFixed(2)}:1 (needs ${want.toFixed(2)}:1) — it will be cropped`,
        small && `Too small — may look blurry (needs ~${spec.w}px wide)`,
        hostMsg,
      ]
        .filter(Boolean)
        .join(". ");

      setS({ st: msgs ? "warn" : "ok", msg: msgs || "Looks good", w, h });
    };

    img.onerror = () => {
      if (!stale)
        setS({ st: "error", msg: "Can't load this image. Check the URL." });
    };

    img.src = value.trim();

    return () => {
      stale = true;
    };
  }, [value, spec]);

  const box = compact ? 64 : 160;
  const color = {
    ok: "#7cd67c",
    warn: "#f0b429",
    error: "#ff6b6b",
    loading: "#999",
    empty: "#999",
  }[s.st];

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div
        style={{
          width: box,
          aspectRatio: `${spec.w} / ${spec.h}`,
          background: "#111",
          border: `1px solid ${color}`,
          borderRadius: 6,
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {s.st !== "empty" && s.st !== "error" && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={value}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid var(--admin-border, #333)",
            background: "var(--admin-surface, #1a1a1a)",
            color: "var(--admin-text, #fff)",
          }}
        />
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
          Needs {spec.w}×{spec.h}px. {spec.note}
        </div>
        <div style={{ fontSize: 12, color, marginTop: 2 }}>
          {s.st === "loading"
            ? "Checking…"
            : s.st === "empty"
            ? ""
            : `${s.w ? s.w + "×" + s.h + " · " : ""}${s.msg}`}
        </div>
      </div>
    </div>
  );
}
