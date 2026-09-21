import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { ScrollRestoration } from "@/components/ScrollRestoration";

import { MetaPixel } from "@/components/MetaPixel";

import SiteChrome from "@/components/SiteChrome";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "nanos.pk — Keep it simple. Wear it your way.",
  description: "Everyday essentials engineered for utility and effortless style. Delivered across Pakistan.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <MetaPixel />
        <AuthProvider>
          <CartProvider>
            <ScrollRestoration />
            <SiteChrome>
              <Navbar />
            </SiteChrome>
            {children}
            <SiteChrome>
              <Footer />
              <CartDrawer />
            </SiteChrome>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
