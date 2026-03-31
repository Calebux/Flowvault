"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExpenseEntry {
  id: string;
  description: string;
  amountUSD: number;
  token: "USDC" | "USDT";
  dueDate: number;
  reserved: boolean;
}

interface TreasuryStats {
  totalUSD: number;
  stableReserveUSD: number;
  reservedUSD: number;
  availableStableUSD: number;
  runwayMonths: number;
  yieldEarnedUSD: number;
}

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
  background:
    color === "green"
      ? "rgba(22,163,74,0.1)"
      : color === "amber"
      ? "rgba(245,158,11,0.1)"
      : "rgba(25,25,24,0.06)",
  color:
    color === "green"
      ? "#16a34a"
      : color === "amber"
      ? "#b45309"
      : "rgba(25,25,24,0.5)",
});

// ─── Add Expense Modal ────────────────────────────────────────────────────────

function AddExpenseModal({
  onClose,
  onAdd,
  isAdding,
}: {
  onClose: () => void;
  onAdd: (data: { description: string; amountUSD: number; token: string; dueDate: number }) => void;
  isAdding: boolean;
}) {
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<"USDC" | "USDT">("USDC");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim()) { setError("Description is required"); return; }
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    if (!dueDate) { setError("Due date is required"); return; }
    setError("");
    onAdd({
      description: desc.trim(),
      amountUSD: amt,
      token,
      dueDate: new Date(dueDate).getTime(),
    });
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.5rem 0.75rem",
    border: "1px solid rgba(25,25,24,0.15)",
    borderRadius: 6,
    fontSize: "0.8rem",
    fontFamily: "inherit",
    outline: "none",
    background: "white",
    color: "#191918",
    boxSizing: "border-box" as const,
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(25,25,24,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "white", borderRadius: 12, padding: "1.5rem", width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "#191918" }}>Add Expense</p>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(25,25,24,0.4)", fontSize: "1.1rem", lineHeight: 1 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div>
            <p style={{ ...label, marginBottom: "0.35rem" }}>Description</p>
            <input
              style={inputStyle}
              placeholder="e.g. Q3 Contributor Payroll"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              maxLength={100}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <p style={{ ...label, marginBottom: "0.35rem" }}>Amount (USD)</p>
              <input
                style={inputStyle}
                type="number"
                placeholder="0"
                min="0"
                step="100"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            <div>
              <p style={{ ...label, marginBottom: "0.35rem" }}>Token</p>
              <select
                style={{ ...inputStyle, cursor: "pointer" }}
                value={token}
                onChange={e => setToken(e.target.value as "USDC" | "USDT")}
              >
                <option value="USDC">USDC</option>
                <option value="USDT">USDT</option>
              </select>
            </div>
          </div>

          <div>
            <p style={{ ...label, marginBottom: "0.35rem" }}>Due Date</p>
            <input
              style={inputStyle}
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>

          {error && (
            <p style={{ fontSize: "0.7rem", color: "#ef4444" }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: "0.5rem",
                border: "1px solid rgba(25,25,24,0.12)",
                borderRadius: 6,
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                background: "transparent",
                color: "rgba(25,25,24,0.6)",
                fontFamily: "var(--font-mono, monospace)",
                textTransform: "uppercase" as const,
                letterSpacing: "0.05em",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAdding}
              style={{
                flex: 2,
                padding: "0.5rem",
                border: "none",
                borderRadius: 6,
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: isAdding ? "default" : "pointer",
                background: "#191918",
                color: "white",
                fontFamily: "var(--font-mono, monospace)",
                textTransform: "uppercase" as const,
                letterSpacing: "0.05em",
                opacity: isAdding ? 0.6 : 1,
              }}
            >
              {isAdding ? "Adding…" : "Add Expense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TreasuryPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: expenses = [], isLoading: loadingExpenses } = useQuery<ExpenseEntry[]>({
    queryKey: ["treasury-expenses"],
    queryFn: () => fetch("/api/treasury/expenses").then(r => r.json()),
    refetchInterval: 15000,
  });

  const { data: treasury = {
    totalUSD: 0,
    stableReserveUSD: 0,
    reservedUSD: 0,
    availableStableUSD: 0,
    runwayMonths: 0,
    yieldEarnedUSD: 0,
  } } = useQuery<TreasuryStats>({
    queryKey: ["treasury-stats"],
    queryFn: () => fetch("/api/treasury/stats").then(r => r.json()),
    refetchInterval: 15000,
  });

  const addExpense = useMutation({
    mutationFn: (data: { description: string; amountUSD: number; token: string; dueDate: number }) =>
      fetch("/api/treasury/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treasury-expenses"] });
      qc.invalidateQueries({ queryKey: ["treasury-stats"] });
      setShowModal(false);
    },
  });

  const deleteExpense = useMutation({
    mutationFn: (id: string) => fetch(`/api/treasury/expenses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ["treasury-expenses"] });
      qc.invalidateQueries({ queryKey: ["treasury-stats"] });
    },
  });

  const toggleReserved = useMutation({
    mutationFn: ({ id, reserved }: { id: string; reserved: boolean }) =>
      fetch(`/api/treasury/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reserved }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treasury-expenses"] });
      qc.invalidateQueries({ queryKey: ["treasury-stats"] });
    },
  });

  // Derived from live expense list
  const totalReserved = expenses.filter(e => e.reserved).reduce((s, e) => s + e.amountUSD, 0);
  const totalUpcoming = expenses.reduce((s, e) => s + e.amountUSD, 0);
  const coveragePct = totalUpcoming > 0 ? (totalReserved / totalUpcoming) * 100 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em", color: "#191918", marginBottom: "0.25rem" }}>
          DAO Treasury
        </h1>
        <p style={{ fontSize: "0.75rem", color: "rgba(25,25,24,0.5)" }}>
          Expense reserves, runway tracking, and treasury health — live from on-chain balances
        </p>
      </div>

      {/* Top metrics row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
        <div style={card}>
          <p style={label}>Total Treasury</p>
          <p style={bigNum}>
            {treasury.totalUSD > 0 ? formatUSD(treasury.totalUSD) : "—"}
          </p>
          <p style={{ ...label, marginTop: "0.25rem", color: "rgba(25,25,24,0.3)" }}>
            across all tokens
          </p>
        </div>
        <div style={card}>
          <p style={label}>Stable Reserves</p>
          <p style={bigNum}>
            {treasury.stableReserveUSD > 0 ? formatUSD(treasury.stableReserveUSD) : "—"}
          </p>
          <p style={{ ...label, marginTop: "0.25rem", color: "rgba(25,25,24,0.35)" }}>
            {formatUSD(treasury.reservedUSD)} ring-fenced
          </p>
        </div>
        <div style={card}>
          <p style={label}>Available (unallocated)</p>
          <p style={{ ...bigNum, color: "#16a34a" }}>
            {formatUSD(treasury.availableStableUSD)}
          </p>
        </div>
        <div style={card}>
          <p style={label}>Runway</p>
          <p style={bigNum}>
            {treasury.runwayMonths > 0 ? `${treasury.runwayMonths.toFixed(1)} mo` : "—"}
          </p>
          <p style={{ ...label, marginTop: "0.25rem", color: "rgba(25,25,24,0.35)" }}>
            at current burn rate
          </p>
        </div>
      </div>

      {/* Reserve coverage bar */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <p style={{ ...label, marginBottom: 0 }}>Reserve Coverage</p>
          <p style={{
            fontSize: "0.7rem",
            fontWeight: 600,
            color: coveragePct >= 100 ? "#16a34a" : coveragePct >= 50 ? "#b45309" : "#ef4444",
          }}>
            {totalUpcoming > 0 ? `${coveragePct.toFixed(0)}% covered` : "No expenses scheduled"}
          </p>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: "rgba(25,25,24,0.06)", overflow: "hidden" }}>
          <div style={{
            height: "100%",
            borderRadius: 99,
            width: `${Math.min(100, coveragePct)}%`,
            background: coveragePct >= 100
              ? "linear-gradient(90deg, #16a34a, #22c55e)"
              : "linear-gradient(90deg, #f59e0b, #fbbf24)",
            transition: "width 0.6s ease",
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
              {loadingExpenses ? "Loading…" : `${expenses.length} upcoming payment${expenses.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
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
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            + Add Expense
          </button>
        </div>

        {expenses.length === 0 && !loadingExpenses ? (
          <div style={{
            textAlign: "center",
            padding: "2rem",
            color: "rgba(25,25,24,0.3)",
            fontSize: "0.75rem",
          }}>
            No expenses scheduled. Add your first expense above.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {expenses
              .slice()
              .sort((a, b) => a.dueDate - b.dueDate)
              .map((expense) => {
                const days = daysUntil(expense.dueDate);
                const urgency = days <= 30 ? "high" : days <= 60 ? "medium" : "low";
                const isDeleting = deletingId === expense.id;

                return (
                  <div
                    key={expense.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.75rem 0.875rem",
                      borderRadius: 8,
                      gap: "0.5rem",
                      background:
                        urgency === "high"
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
                      opacity: isDeleting ? 0.5 : 1,
                      transition: "opacity 0.2s",
                    }}
                  >
                    {/* Left: description + due date */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: "0.8rem", color: "#191918", marginBottom: "0.15rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {expense.description}
                      </p>
                      <p style={{ fontSize: "0.65rem", color: "rgba(25,25,24,0.45)" }}>
                        Due {formatDate(expense.dueDate)} · {days}d away
                      </p>
                    </div>

                    {/* Amount + token */}
                    <div style={{ textAlign: "right", flexShrink: 0, marginRight: "0.75rem" }}>
                      <p style={{ fontWeight: 700, fontSize: "0.85rem", color: "#191918", fontFamily: "var(--font-mono, monospace)" }}>
                        {formatUSD(expense.amountUSD)}
                      </p>
                      <p style={{ fontSize: "0.6rem", color: "rgba(25,25,24,0.4)", fontFamily: "var(--font-mono, monospace)" }}>
                        {expense.token}
                      </p>
                    </div>

                    {/* Reserved badge — clickable to toggle */}
                    <button
                      onClick={() => toggleReserved.mutate({ id: expense.id, reserved: !expense.reserved })}
                      title={expense.reserved ? "Click to un-reserve" : "Click to mark reserved"}
                      style={{
                        ...badge(expense.reserved ? "green" : "amber"),
                        cursor: "pointer",
                        border: "none",
                        flexShrink: 0,
                      }}
                    >
                      {expense.reserved ? "✓ Reserved" : "Pending"}
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => {
                        setDeletingId(expense.id);
                        deleteExpense.mutate(expense.id);
                      }}
                      disabled={isDeleting}
                      title="Remove expense"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: isDeleting ? "default" : "pointer",
                        color: "rgba(25,25,24,0.25)",
                        fontSize: "0.85rem",
                        lineHeight: 1,
                        padding: "0.1rem 0.2rem",
                        flexShrink: 0,
                        transition: "color 0.15s",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(25,25,24,0.25)"; }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Yield earnings + AI note */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div style={card}>
          <p style={label}>Yield on Idle Stablecoins</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginTop: "0.25rem" }}>
            <p style={{ ...bigNum, color: "#16a34a" }}>
              +{formatUSD(treasury.yieldEarnedUSD)}
            </p>
            <p style={{ fontSize: "0.7rem", color: "rgba(25,25,24,0.45)" }}>earned to date</p>
          </div>
          <p style={{ fontSize: "0.65rem", color: "rgba(25,25,24,0.4)", marginTop: "0.5rem" }}>
            80% of idle USDC/USDT deployed to IncrementFi lending vaults at ~5% APY.
          </p>
        </div>

        <div style={card}>
          <p style={label}>AI Agent Role</p>
          <p style={{ fontSize: "0.75rem", color: "#191918", fontWeight: 500, marginTop: "0.25rem", lineHeight: 1.5 }}>
            Before any rebalance, the agent checks this schedule. It will never reduce stable reserves below reserved amounts.
          </p>
          <p style={{ fontSize: "0.65rem", color: "rgba(25,25,24,0.4)", marginTop: "0.5rem" }}>
            Every reserve decision is emitted as a Flow event — permanently auditable on-chain.
          </p>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showModal && (
        <AddExpenseModal
          onClose={() => setShowModal(false)}
          onAdd={data => addExpense.mutate(data)}
          isAdding={addExpense.isPending}
        />
      )}
    </div>
  );
}
