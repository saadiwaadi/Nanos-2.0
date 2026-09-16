"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (auth.isLoggedIn) {
      router.push("/account");
    }
  }, [auth.isLoggedIn, router]);

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error?.message || data.message || "Failed to log in");
        setIsSubmitting(false);
        return;
      }

      auth.login(data.user, data.token);
      router.push("/account");
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred");
      setIsSubmitting(false);
    }
  }

  async function handleSignupSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: signupName,
          email: signupEmail,
          password: signupPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error?.message || data.message || "Failed to create account");
        setIsSubmitting(false);
        return;
      }

      auth.login(data.user, data.token);
      router.push("/account");
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="auth-wrap">
        <div className="auth-card">
          {/* Auth Tabs */}
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${activeTab === "login" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("login");
                setErrorMsg(null);
              }}
            >
              Log In
            </button>
            <button
              type="button"
              className={`auth-tab ${activeTab === "signup" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("signup");
                setErrorMsg(null);
              }}
            >
              Sign Up
            </button>
          </div>

          {/* Log In Tab */}
          {activeTab === "login" && (
            <div>
              <h2 style={{ fontFamily: "var(--font-head)", fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
                Welcome back
              </h2>
              <p style={{ color: "#777", fontSize: 13.5, marginBottom: 24 }}>
                Log in to view your orders and saved items.
              </p>

              <form onSubmit={handleLoginSubmit} className="auth-form">
                <div className="form-group">
                  <label htmlFor="login-email">Email Address</label>
                  <input
                    type="email"
                    id="login-email"
                    required
                    placeholder="you@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label htmlFor="login-password">Password</label>
                    <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 12, color: "#777" }}>
                      Forgot password?
                    </a>
                  </div>
                  <input
                    type="password"
                    id="login-password"
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                </div>

                {errorMsg && (
                  <div style={{ color: "#c0392b", fontSize: 13, marginTop: 4 }}>
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary btn-block"
                  style={{ marginTop: 8 }}
                >
                  {isSubmitting ? "Logging in..." : "Log In"}
                </button>
              </form>

              <div style={{ textTransform: "uppercase", fontSize: 11, color: "#aaa", textAlign: "center", margin: "20px 0 16px" }}>
                or
              </div>

              <Link href="/" className="btn btn-outline btn-block">
                Continue as Guest
              </Link>
            </div>
          )}

          {/* Sign Up Tab */}
          {activeTab === "signup" && (
            <div>
              <h2 style={{ fontFamily: "var(--font-head)", fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
                Create your account
              </h2>
              <p style={{ color: "#777", fontSize: 13.5, marginBottom: 24 }}>
                Join nanos.pk for faster checkout and order tracking.
              </p>

              <form onSubmit={handleSignupSubmit} className="auth-form">
                <div className="form-group">
                  <label htmlFor="signup-name">Full Name</label>
                  <input
                    type="text"
                    id="signup-name"
                    required
                    placeholder="Ali Raza"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="signup-email">Email Address</label>
                  <input
                    type="email"
                    id="signup-email"
                    required
                    placeholder="you@example.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="signup-password">Password</label>
                  <input
                    type="password"
                    id="signup-password"
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                  />
                </div>

                {errorMsg && (
                  <div style={{ color: "#c0392b", fontSize: 13, marginTop: 4 }}>
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary btn-block"
                  style={{ marginTop: 8 }}
                >
                  {isSubmitting ? "Creating account..." : "Create Account"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
