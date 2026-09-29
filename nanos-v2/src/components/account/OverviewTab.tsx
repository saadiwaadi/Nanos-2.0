"use client";

import React, { useCallback } from "react";
import Link from "next/link";
import { AccountSummaryData } from "@/lib/account-summary";
import { StatsStrip } from "./StatsStrip";
import { ActiveOrders } from "./ActiveOrders";
import { ReviewPrompts } from "./ReviewPrompts";
import { useSWR } from "@/lib/swr";

interface OverviewTabProps {
  userName?: string;
  onNavigateTab?: (tab: string) => void;
}

export function OverviewTab({ userName }: OverviewTabProps) {
  const fetchSummary = useCallback(async () => {
    let token: string | null = null;
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("nanos_auth_v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        token = parsed.token || null;
      }
    }

    if (!token) {
      throw new Error("User is not authenticated.");
    }

    const res = await fetch("/api/account/summary", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error("Failed to load account summary.");
    }

    return (await res.json()) as AccountSummaryData;
  }, []);

  // SWR: instantaneous render on returning visits, 60s background revalidation, quiet error handling
  const {
    data,
    isLoading: loading,
    error,
    revalidate: fetchSummaryData,
  } = useSWR<AccountSummaryData>("account:summary", fetchSummary, {
    staleTime: 60 * 1000,
  });

  const errorMessage = error?.message || null;

  // Loading skeleton (only on first-ever visit when no cached data exists)
  if (loading && !data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Stats Strip Skeleton */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginBottom: 20,
          }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 104,
                borderRadius: 8,
                background: "var(--white)",
                border: "1px solid var(--stone)",
                padding: 20,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                animation: "pulse 1.5s infinite ease-in-out",
              }}
            >
              <div style={{ width: "40%", height: 14, background: "var(--stone)", borderRadius: 4 }} />
              <div style={{ width: "60%", height: 26, background: "var(--stone)", borderRadius: 4 }} />
            </div>
          ))}
        </div>

        {/* Section Skeleton */}
        <div
          style={{
            background: "var(--white)",
            border: "1px solid var(--stone)",
            borderRadius: 8,
            padding: 24,
            height: 180,
          }}
        >
          <div style={{ width: "30%", height: 18, background: "var(--stone)", borderRadius: 4, marginBottom: 16 }} />
          <div style={{ width: "100%", height: 80, background: "var(--cream, #fdfbf7)", borderRadius: 6 }} />
        </div>
      </div>
    );
  }

  // Error state (only if first load failed and we have no cached data to display)
  if (errorMessage && !data) {
    return (
      <div
        style={{
          background: "var(--white)",
          border: "1px solid #fca5a5",
          borderRadius: 8,
          padding: 24,
          textAlign: "center",
          color: "#991b1b",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
          Could not load your account overview
        </div>
        <div style={{ fontSize: 13.5, color: "#666", marginBottom: 16 }}>{errorMessage}</div>
        <button
          type="button"
          onClick={() => fetchSummaryData()}
          className="btn btn-outline btn-sm"
          style={{ padding: "8px 18px", fontSize: 13 }}
        >
          Try Again
        </button>
      </div>
    );
  }

  // Brand new user with 0 total orders: Welcoming empty state instead of zeros
  if (data?.isNewUser) {
    const displayName = userName ? userName.split(" ")[0] : "Customer";

    return (
      <div
        style={{
          background: "var(--white)",
          border: "1px solid var(--stone)",
          borderRadius: 8,
          padding: "44px 28px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "var(--black)",
            color: "var(--lime)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-head)",
            fontSize: 24,
            fontWeight: 700,
          }}
        >
          ✦
        </div>

        <div style={{ maxWidth: 480 }}>
          <h2
            style={{
              fontFamily: "var(--font-head)",
              fontSize: 24,
              fontWeight: 700,
              color: "var(--black)",
              letterSpacing: "-0.01em",
              marginBottom: 8,
            }}
          >
            Welcome to Nanos, {displayName}!
          </h2>
          <p style={{ color: "#666", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            You haven&apos;t placed any orders yet. Discover our collection of lightweight clogs and comfort trousers designed for all-day wear.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/products" className="btn btn-primary" style={{ minWidth: 160 }}>
            Start shopping
          </Link>
          <Link href="/products?tag=NEW" className="btn btn-outline" style={{ minWidth: 140 }}>
            New Arrivals
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 1. Stats Strip */}
      {data?.stats && <StatsStrip stats={data.stats} />}

      {/* 2. Active Orders */}
      <ActiveOrders orders={data?.activeOrders || []} />

      {/* 3. Review Prompts */}
      <ReviewPrompts
        items={data?.unreviewedItems || []}
        onReviewSubmitted={() => fetchSummaryData()}
      />
    </div>
  );
}
