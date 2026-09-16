"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { CartBadge } from "./CartBadge";

export function Navbar() {
  const pathname = usePathname();
  const { isLoggedIn } = useAuth();

  return (
    <header className="site-header">
      <div className="header-inner">
        {/* Left Navigation Links */}
        <nav className="main-nav">
          <Link
            href="/products"
            className={pathname === "/products" ? "active" : ""}
          >
            Shop
          </Link>
          <Link
            href="/crocs"
            className={pathname === "/crocs" ? "active" : ""}
          >
            Crocs
          </Link>
          <Link
            href="/trousers"
            className={pathname === "/trousers" ? "active" : ""}
          >
            Trousers
          </Link>
        </nav>

        {/* Center Logo */}
        <Link href="/" className="logo" aria-label="nanos.pk home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://res.cloudinary.com/tp1vyxi3/image/upload/v1789301766/ChatGPT_Image_Sep_13__2026__05_15_23_AM-removebg-preview.png"
            alt="nanos.pk"
            width={120}
            height={32}
            className="logo-img"
          />
        </Link>

        {/* Right Header Actions */}
        <div className="header-actions">
          {/* Search Icon */}
          <button type="button" className="icon-btn" aria-label="Search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

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

          {/* Cart Icon */}
          <Link href="/cart" className="icon-btn" aria-label="Open cart">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <CartBadge />
          </Link>
        </div>
      </div>
    </header>
  );
}
