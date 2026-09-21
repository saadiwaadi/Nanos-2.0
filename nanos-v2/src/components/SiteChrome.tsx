"use client";

import { usePathname } from "next/navigation";

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const p = usePathname();
  return p?.startsWith("/admin") ? null : <>{children}</>;
}
