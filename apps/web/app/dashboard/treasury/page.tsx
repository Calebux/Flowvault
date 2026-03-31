"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExpenseEntry {
  id: string;
  description: string;
  amountUSD: number;
  token: "USDC" | "USDT";
  dueDate: number;
  reserved: boolean;
}

// ─── Mock data (replaced by real API calls in production) ─────────────────────

const MOCK_EXPENSES: ExpenseEntry[] = [
  {
    id: "1",
    description: "Q2 Contributor Payroll",
    amountUSD: 45000,
    token: "USDC",
    dueDate: Date.now() + 32 * 86400_000,
    reserved: true,
  },
  {
    id: "2",
    description: "Audit Retainer — Trail of Bits",
    amountUSD: 25000,
    token: "USDC",
    dueDate: Date.now() + 58 * 86400_000,
    reserved: true,
  },
  {
    id: "3",
    description: "Community Grants — Round 3",
    amountUSD: 15000,
    token: "USDT",
    dueDate: Date.now() + 75 * 86400_000,
    reserved: false,
  },
  {
    id: "4",
    description: "Protocol Insurance Premium",
    amountUSD: 8000,
    token: "USDC",
    dueDate: Date.now() + 90 * 86400_000,
    reserved: false,
  },
];

const MOCK_TREASURY = {
  totalUSD: 842000,
  stableReserveUSD: 285000,
  reservedUSD: 70000,
  availableStableUSD: 215000,
  runwayMonths: 6.3,
  yieldEarnedUSD: 3240,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(timestamp: number): number {
  return Math.ceil((timestamp - Date.now()) / 86400_000);
}

function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "white",
  border: "1px solid rgba(25,25,24,0.08)",
  borderRadius: 12,
  padding: "1.25rem",
};

const label: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "0.6rem",
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  color: "rgba(25,25,24,0.4)",
  marginBottom: "0.25rem",
};

const bigNum: React.CSSProperties = {
  fontSize: "1.75rem",
  fontWeight: 700,
  letterSpacing: "-0.03em",
  color: "#191918",
  lineHeight: 1.1,
};

const badge = (color: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "0.15rem 0.5rem",
  borderRadius: 99,
  fontSize: "0.6rem",
  fontWeight: 600,
  fontFamily: "var(--font-mono, monospace)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  background: color === "green" ? "rgba(22,163,74,0.1)" : color === "amber" ? "rgba(245,158,11,0.1)" : "rgba(25,25,24,0.06)",
  color: color === "green" ? "#16a34a" : color === "amber" ? "#b45309" : "rgba(25,25,24,0.5)",
});

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TreasuryPage() {
  const [expenses] = useState<ExpenseEntry[]>(MOCK_EXPENSES);
  const treasury = MOCK_TREASURY;

  const totalReserved = expenses.filter(e => e.reserved).reduce((s, e) => s + e.amountUSD, 0);
  const totalUpcoming = expenses.reduce((s, e) => s + e.amountUSD, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em", color: "#191918", marginBottom: "0.25rem" }}>
          DAO Treasury
        </h1>
        <p style={{ fontSize: "0.75rem", color: "rgba(25,25,24,0.5)" }}>
          Expense reserves, runway tracking, and treasury health
        </p>
      </div>

      {/* Top metrics row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
        <div style={card}>
          <p style={label}>Total Treasury</p>
          <p style={bigNum}>{formatUSD(treasury.totalUSD)}</p>
        </div>
        <div style={card}>
          <p style={label}>Stable Reserves</p>
          <p style={bigNum}>{formatUSD(treasury.stableReserveUSD)}</p>
          <p style={{ ...label, marginTop: "0.25rem", color: "rgba(25,25,24,0.35)" }}>
            {formatUSD(treasury.reservedUSD)} ring-fenced
          </p>
        </div>
        <div style={card}>
          <p style={label}>Available (unallocated)</p>
          <p style={{ ...bigNum, color: "#16a34a" }}>{formatUSD(treasury.availableStableUSD)}</p>
        </div>
        <div style={card}>
          <p style={label}>Runway</p>
          <p style={bigNum}>{treasury.runwayMonths.toFixed(1)} mo</p>
          <p style={{ ...label, marginTop: "0.25rem", color: "rgba(25,25,24,0.35)" }}>
            at current burn rate
          </p>
        </div>
      </div>

      {/* Reserve bar */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <p style={{ ...label, marginBottom: 0 }}>Reserve Coverage</p>
          <p style={{ fontSize: "0.7rem", fontWeight: 600, color: totalReserved >= totalUpcoming ? "#16a34a" : "#b45309" }}>
            {((totalReserved / totalUpcoming) * 100).toFixed(0)}% covered
          </p>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: "rgba(25,25,24,0.06)", overflow: "hidden" }}>
          <div style={{
            height: "100%",
            borderRadius: 99,
            width: `${Math.min(100, (totalReserved / totalUpcoming) * 100)}%`,
            background: totalReserved >= totalUpcoming
              ? "linear-gradient(90deg, #16a34a, #22c55e)"
              : "linear-gradient(90deg, #f59e0b, #fbbf24)",
            transition: "width 0.5s ease",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.35rem" }}>
          <span style={{ fontSize: "0.6rem", color: "rgba(25,25,24,0.4)" }}>
            Reserved: {formatUSD(totalReserved)}
          </span>
          <span style={{ fontSize: "0.6rem", color: "rgba(25,25,24,0.4)" }}>
            Total needed: {formatUSD(totalUpcoming)}
          </span>
        </div>
      </div>

      {/* Expense schedule */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <p style={{ ...label, marginBottom: "0.15rem" }}>Expense Schedule</p>
            <p style={{ fontSize: "0.65rem", color: "rgba(25,25,24,0.4)" }}>
              Upcoming payments within 90 days
            </p>
          </div>
          <button style={{
            background: "#191918",
            color: "white",
            border: "none",
            padding: "0.4rem 0.75rem",
            borderRadius: 6,
            fontSize: "0.65rem",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "var(--font-mono, monospace)",
            textTransform: "uppercase" as const,
            letterSpacing: "0.05em",
          }}>
            + Add Expense
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {expenses.map((expense) => {
            const days = daysUntil(expense.dueDate);
            const urgency = days <= 30 ? "high" : days <= 60 ? "medium" : "low";
            return (
              <div
                key={expense.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.75rem 0.875rem",
                  borderRadius: 8,
                  background: urgency === "high"
                    ? "rgba(239,68,68,0.03)"
                    : urgency === "medium"
                      ? "rgba(245,158,11,0.03)"
                      : "rgba(25,25,24,0.02)",
                  border: `1px solid ${
                    urgency === "high"
                      ? "rgba(239,68,68,0.12)"
                      : urgency === "medium"
                        ? "rgba(245,158,11,0.1)"
                        : "rgba(25,25,24,0.06)"
                  }`,
                }}
              >
                {/* Left: description + due date */}
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: "0.8rem", color: "#191918", marginBottom: "0.15rem" }}>
                    {expense.description}
                  </p>
                  <p style={{ fontSize: "0.65rem", color: "rgba(25,25,24,0.45)" }}>
                    Due {formatDate(expense.dueDate)} · {days}d away
                  </p>
                </div>

                {/* Middle: amount + token */}
                <div style={{ textAlign: "right", marginRight: "1rem" }}>
                  <p style={{ fontWeight: 700, fontSize: "0.85rem", color: "#191918", fontFamily: "var(--font-mono, monospace)" }}>
                    {formatUSD(expense.amountUSD)}
                  </p>
                  <p style={{ fontSize: "0.6rem", color: "rgba(25,25,24,0.4)", fontFamily: "var(--font-mono, monospace)" }}>
                    {expense.token}
                  </p>
                </div>

                {/* Right: status badge */}
                <span style={badge(expense.reserved ? "green" : "amber")}>
                  {expense.reserved ? "✓ Reserved" : "Pending"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Yield earnings */}
      <div style={card}>
        <p style={label}>Yield on Idle Stablecoins</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginTop: "0.25rem" }}>
          <p style={{ ...bigNum, color: "#16a34a" }}>+{formatUSD(treasury.yieldEarnedUSD)}</p>
          <p style={{ fontSize: "0.7rem", color: "rgba(25,25,24,0.45)" }}>earned to date</p>
        </div>
        <p style={{ fontSize: "0.65rem", color: "rgba(25,25,24,0.4)", marginTop: "0.5rem" }}>
          80% of idle USDC/USDT deployed to IncrementFi lending vaults. 20% kept liquid for gas + swaps.
        </p>
      </div>
    </div>
  );
}
