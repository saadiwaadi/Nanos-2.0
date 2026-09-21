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
  return (
    <div
      style={{
        minHeight: "100dvh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        flex: "1 1 auto",
      }}
    >
      {children}
    </div>
  );
}
