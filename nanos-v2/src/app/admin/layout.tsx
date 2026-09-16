import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "nanos admin",
  description: "nanos.pk admin management panel",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div style={{ minHeight: "100vh" }}>{children}</div>;
}
