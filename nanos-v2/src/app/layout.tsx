import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { ScrollRestoration } from "@/components/ScrollRestoration";
import { WhatsAppButton } from "@/components/WhatsAppButton";

import { MetaPixel } from "@/components/MetaPixel";

import SiteChrome from "@/components/SiteChrome";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "nanos.pk — Keep it simple. Wear it your way.",
  description: "Everyday essentials engineered for utility and effortless style. Delivered across Pakistan.",
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/apple-icon.png",
  },
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
          <WishlistProvider>
            <CartProvider>
              <ScrollRestoration />
              <SiteChrome>
                <Navbar />
              </SiteChrome>
              {children}
              <SiteChrome>
                <Footer />
                <CartDrawer />
                <WhatsAppButton />
              </SiteChrome>
            </CartProvider>
          </WishlistProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
