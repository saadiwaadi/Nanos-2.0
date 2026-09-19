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
            <h4 className="footer-brand-title">nanos.pk</h4>
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
                  <span className="footer-link-arrow">→</span>
                </Link>
              </li>
              <li>
                <Link href="/trousers">
                  <span className="footer-link-text">Trousers</span>
                  <span className="footer-link-arrow">→</span>
                </Link>
              </li>
              <li>
                <Link href="/products?sale=true">
                  <span className="footer-link-text">Sale Items</span>
                  <span className="footer-link-arrow">→</span>
                </Link>
              </li>
              <li>
                <Link href="/products">
                  <span className="footer-link-text">All Products</span>
                  <span className="footer-link-arrow">→</span>
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
                  <span className="footer-link-arrow">→</span>
                </Link>
              </li>
              <li>
                <Link href="/account">
                  <span className="footer-link-text">My Account</span>
                  <span className="footer-link-arrow">→</span>
                </Link>
              </li>
              <li>
                <Link href="/account">
                  <span className="footer-link-text">Order History</span>
                  <span className="footer-link-arrow">→</span>
                </Link>
              </li>
              <li>
                <Link href="/cart">
                  <span className="footer-link-text">Shopping Cart</span>
                  <span className="footer-link-arrow">→</span>
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
                  <span className="footer-link-arrow">→</span>
                </Link>
              </li>
              <li>
                <Link href="#">
                  <span className="footer-link-text">Shipping Policy</span>
                  <span className="footer-link-arrow">→</span>
                </Link>
              </li>
              <li>
                <Link href="#">
                  <span className="footer-link-text">Returns &amp; Exchanges</span>
                  <span className="footer-link-arrow">→</span>
                </Link>
              </li>
              <li>
                <Link href="#">
                  <span className="footer-link-text">Contact Support</span>
                  <span className="footer-link-arrow">→</span>
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
            <a href="#" aria-label="Instagram">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>
            {/* TikTok */}
            <a href="#" aria-label="TikTok">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 1 1-5.2-1.74 2.89 2.89 0 0 1 2.31-2.82V7.58a6.34 6.34 0 0 0-5.61 6.27A6.34 6.34 0 0 0 10.2 20.2a6.34 6.34 0 0 0 6.34-6.34V9.37a8.16 8.16 0 0 0 4.93 1.63V7.55a4.85 4.85 0 0 1-1.88-.86z" />
              </svg>
            </a>
            {/* Facebook */}
            <a href="#" aria-label="Facebook">
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
