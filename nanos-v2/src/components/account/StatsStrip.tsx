"use client";

import React from "react";
import { AccountStats } from "@/lib/account-summary";

interface StatsStripProps {
  stats: AccountStats;
}

export function StatsStrip({ stats }: StatsStripProps) {
  const formattedSpent = "PKR " + (stats.totalSpentDelivered || 0).toLocaleString("en-PK");

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 16,
        marginBottom: 28,
      }}
    >
      {/* Stat 1: Total Spent (Delivered Only) */}
      <div
        style={{
          background: "var(--black)",
          color: "var(--white)",
          padding: "20px 22px",
          borderRadius: 8,
          border: "1px solid #222",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          minHeight: 104,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "rgba(255, 255, 255, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>Total Spent</span>
          <span
            style={{
              fontSize: 10.5,
              padding: "2px 7px",
              borderRadius: 3,
              background: "rgba(202, 255, 0, 0.15)",
              color: "var(--lime)",
              fontWeight: 700,
              letterSpacing: 0,
            }}
          >
            Delivered Only
          </span>
        </div>
        <div
          style={{
            fontFamily: "var(--font-head)",
            fontSize: 26,
            fontWeight: 700,
            color: "var(--lime)",
            marginTop: 8,
            letterSpacing: "-0.02em",
          }}
        >
          {formattedSpent}
        </div>
      </div>

      {/* Stat 2: Delivered Orders */}
      <div
        style={{
          background: "var(--white)",
          color: "var(--black)",
          padding: "20px 22px",
          borderRadius: 8,
          border: "1px solid var(--stone)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          minHeight: 104,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "#666",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Delivered Orders</span>
        </div>
        <div
          style={{
            fontFamily: "var(--font-head)",
            fontSize: 28,
            fontWeight: 700,
            color: "var(--black)",
            marginTop: 8,
          }}
        >
          {stats.deliveredCount}
        </div>
      </div>

      {/* Stat 3: In Progress */}
      <div
        style={{
          background: "var(--white)",
          color: "var(--black)",
          padding: "20px 22px",
          borderRadius: 8,
          border: "1px solid var(--stone)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          minHeight: 104,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "#666",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>In Progress</span>
        </div>
        <div
          style={{
            fontFamily: "var(--font-head)",
            fontSize: 28,
            fontWeight: 700,
            color: stats.inProgressCount > 0 ? "var(--black)" : "#888",
            marginTop: 8,
          }}
        >
          {stats.inProgressCount}
        </div>
      </div>
    </div>
  );
}
