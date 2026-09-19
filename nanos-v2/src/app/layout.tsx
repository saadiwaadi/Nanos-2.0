import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { ScrollRestoration } from "@/components/ScrollRestoration";

import { MetaPixel } from "@/components/MetaPixel";

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
    <html lang="en">
      <body>
        <MetaPixel />
        <AuthProvider>
          <CartProvider>
            <ScrollRestoration />
            <Navbar />
            {children}
            <Footer />
            <CartDrawer />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
