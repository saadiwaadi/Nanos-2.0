"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";

export function Footer() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
    }
  };

  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-grid">
          {/* Brand Col */}
          <div className="footer-col">
            <Link href="/" aria-label="nanos.pk" style={{ display: "inline-block", marginBottom: 14 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://res.cloudinary.com/wj34wxob/image/upload/v1790160668/ChatGPT_Image_Sep_13__2026__05_15_23_AM-removebg-preview.png"
                alt="nanos.pk"
                width={175}
                height={50}
                className="footer-logo-img"
              />
            </Link>
            <p className="footer-brand-desc">
              Everyday essentials engineered for utility and effortless style. Delivered across Pakistan.
            </p>
          </div>

          {/* Categories Col */}
          <div className="footer-col">
            <h4>CATEGORIES</h4>
            <ul>
              <li>
                <Link href="/crocs">
                  <span className="footer-link-text">Crocs</span>
                </Link>
              </li>
              <li>
                <Link href="/trousers">
                  <span className="footer-link-text">Trousers</span>
                </Link>
              </li>
              <li>
                <Link href="/products?sale=true">
                  <span className="footer-link-text">Sale Items</span>
                </Link>
              </li>
              <li>
                <Link href="/products">
                  <span className="footer-link-text">All Products</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Account Col */}
          <div className="footer-col">
            <h4>ACCOUNT</h4>
            <ul>
              <li>
                <Link href="/login">
                  <span className="footer-link-text">Log In / Register</span>
                </Link>
              </li>
              <li>
                <Link href="/account">
                  <span className="footer-link-text">My Account</span>
                </Link>
              </li>
              <li>
                <Link href="/account">
                  <span className="footer-link-text">Order History</span>
                </Link>
              </li>
              <li>
                <Link href="/cart">
                  <span className="footer-link-text">Shopping Cart</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Help & Info Col */}
          <div className="footer-col">
            <h4>HELP &amp; INFO</h4>
            <ul>
              <li>
                <Link href="#">
                  <span className="footer-link-text">Track Order</span>
                </Link>
              </li>
              <li>
                <Link href="#">
                  <span className="footer-link-text">Shipping Policy</span>
                </Link>
              </li>
              <li>
                <Link href="#">
                  <span className="footer-link-text">Returns &amp; Exchanges</span>
                </Link>
              </li>
              <li>
                <Link href="#">
                  <span className="footer-link-text">Contact Support</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter Col */}
          <div className="footer-col footer-newsletter-col">
            <h4>STAY IN THE LOOP</h4>
            <p style={{ fontSize: 13, color: "#999", lineHeight: 1.5, marginBottom: 14 }}>
              Get 10% off your first order plus early access to drops.
            </p>
            {submitted ? (
              <div className="newsletter-success-msg">
                ✓ You&apos;re subscribed! Use code <strong style={{ color: "var(--lime)" }}>NANOS10</strong> for 10% off.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="newsletter-form">
                <input
                  type="email"
                  placeholder="Your email address"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button type="submit">JOIN</button>
              </form>
            )}
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="footer-bottom">
          <div>&copy; {new Date().getFullYear()} nanos.pk — Keep it simple. Wear it your way.</div>
          <div className="footer-social">
            {/* Instagram */}
            <a
              href="https://www.instagram.com/nanos_pk?utm_source=ig_web_button_share_sheet&stkn=ZDNlZDc0MzIxNw=="
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>
            {/* Facebook */}
            <a
              href="https://www.facebook.com/nanos.pk"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
