"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { CartBadge } from "./CartBadge";

export function Navbar() {
  const pathname = usePathname();
  const { isLoggedIn } = useAuth();
  const cart = useCart();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Lock body scroll when left drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // ESC key handler for left drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drawerOpen) {
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen]);

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      <header className="site-header">
        <div
          className="header-inner"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          {/* Left: Hamburger Button & Logo */}
          <div className="header-left" style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <Link
              href="/"
              className="logo"
              aria-label="nanos.pk home"
              style={{
                display: "flex",
                alignItems: "center",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://res.cloudinary.com/tp1vyxi3/image/upload/v1789301766/ChatGPT_Image_Sep_13__2026__05_15_23_AM-removebg-preview.png"
                alt="nanos.pk"
                width={160}
                height={44}
                className="logo-img"
              />
            </Link>
          </div>

          {/* Right: Header Actions */}
          <div className="header-actions" style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Account Icon */}
            <Link
              href={isLoggedIn ? "/account" : "/login"}
              className="icon-btn"
              aria-label={isLoggedIn ? "Account" : "Log In"}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </Link>

            {/* Cart Button (Opens CartDrawer) */}
            <button
              type="button"
              className="icon-btn"
              onClick={cart.openCart}
              aria-label="Open cart drawer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              <CartBadge />
            </button>
          </div>
        </div>
      </header>

      {/* LEFT-SIDE NAVIGATION DRAWER */}
      {drawerOpen && <div className="nav-overlay" onClick={closeDrawer} />}
      <div className={`nav-drawer ${drawerOpen ? "open" : ""}`}>
        <button
          type="button"
          className="nav-drawer-close"
          onClick={closeDrawer}
          aria-label="Close menu"
        >
          ✕
        </button>

        <div className="nav-drawer-logo">
          nanos<span className="pk">.pk</span>
        </div>

        {/* Categories Section */}
        <div className="nav-drawer-section">
          <div className="nav-drawer-section-title">Categories</div>
          <Link
            href="/products"
            className={`nav-drawer-link ${pathname === "/products" ? "active" : ""}`}
            onClick={closeDrawer}
          >
            Shop All →
          </Link>
          <Link
            href="/crocs"
            className={`nav-drawer-link ${pathname === "/crocs" ? "active" : ""}`}
            onClick={closeDrawer}
          >
            Crocs →
          </Link>
          <Link
            href="/trousers"
            className={`nav-drawer-link ${pathname === "/trousers" ? "active" : ""}`}
            onClick={closeDrawer}
          >
            Trousers →
          </Link>
        </div>

        {/* Collections Section */}
        <div className="nav-drawer-section">
          <div className="nav-drawer-section-title">Collections</div>
          <Link
            href="/products?tag=NEW"
            className="nav-drawer-link"
            onClick={closeDrawer}
          >
            New Arrivals →
          </Link>
          <Link
            href="/products?tag=SALE"
            className="nav-drawer-link"
            onClick={closeDrawer}
          >
            Sale →
          </Link>
        </div>

        {/* Account & Orders Section */}
        <div className="nav-drawer-section">
          <div className="nav-drawer-section-title">Account</div>
          <Link
            href={isLoggedIn ? "/account" : "/login"}
            className={`nav-drawer-link ${pathname === "/account" || pathname === "/login" ? "active" : ""}`}
            onClick={closeDrawer}
          >
            My Account →
          </Link>
          <Link
            href={isLoggedIn ? "/account" : "/login"}
            className="nav-drawer-link"
            onClick={closeDrawer}
          >
            Track Order →
          </Link>
        </div>
      </div>
    </>
  );
}
