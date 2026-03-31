"use client";

import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ReasoningEntry {
  id: string;
  time: string;
  message: string;
  type: string;
  action?: string;
}

// ─── Action metadata ──────────────────────────────────────────────────────────
const ACTION_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  execute_swap:       { label: "SWAP",    color: "#ef4444", bg: "rgba(239,68,68,0.1)",    icon: "⇄" },
  deposit_to_yield:   { label: "YIELD",   color: "#8b5cf6", bg: "rgba(139,92,246,0.1)",   icon: "↑" },
  withdraw_from_yield:{ label: "WITHDRAW",color: "#f59e0b", bg: "rgba(245,158,11,0.1)",   icon: "↓" },
  reserve_expense:    { label: "RESERVE", color: "#0ea5e9", bg: "rgba(14,165,233,0.1)",   icon: "🔒" },
  send_alert:         { label: "ALERT",   color: "#f97316", bg: "rgba(249,115,22,0.1)",   icon: "⚠" },
  hold:               { label: "HOLD",    color: "#16a34a", bg: "rgba(22,163,74,0.1)",    icon: "◆" },
};

const DEFAULT_ACTION = { label: "THINK", color: "#7c3aed", bg: "rgba(124,58,237,0.1)", icon: "🧠" };

type ActionMeta = { label: string; color: string; bg: string; icon: string };

function getActionMeta(action?: string): ActionMeta {
  const found = action ? ACTION_META[action] : undefined;
  return found ?? DEFAULT_ACTION;
}

// ─── Demo placeholder entries (shown before agent runs) ───────────────────────
const DEMO_ENTRIES: ReasoningEntry[] = [
  {
    id: "demo-1", time: "12:00:01", action: "hold",
    type: "reasoning",
    message: "Portfolio allocation is within bounds: FLOW at 42.1% (target 40%), USDC at 38.4% (target 40%). Max drift is 2.1% — below the 5% threshold. No rebalance needed. Depositing idle USDC to IncrementFi to earn yield.",
  },
  {
    id: "demo-2", time: "11:30:14", action: "deposit_to_yield",
    type: "reasoning",
    message: "USDC balance of $21,400 is sitting idle. IncrementFi offers 4.2% APY on USDC lending. Deploying 80% ($17,120) to the lending vault while keeping 20% liquid for gas and swaps.",
  },
  {
    id: "demo-3", time: "11:00:22", action: "reserve_expense",
    type: "reasoning",
    message: "Q2 Contributor Payroll of $45,000 USDC is due in 32 days. Current stable reserve is $68,200. Ring-fencing $45,000 USDC before any rebalance to ensure payroll is fully covered regardless of market moves.",
  },
  {
    id: "demo-4", time: "10:30:05", action: "execute_swap",
    type: "reasoning",
    message: "FLOW drifted +8.3% above target (48.3% vs 40%) driven by 12% price appreciation overnight. Selling $6,200 FLOW → USDC to restore target ratio. Drift clearly exceeds threshold and FLOW momentum is tapering.",
  },
  {
    id: "demo-5", time: "10:00:44", action: "send_alert",
    type: "reasoning",
    message: "FLOW is showing a strong 24h uptrend (+7.2%). Drift is approaching threshold at 4.1% (threshold: 5%). Not acting yet — momentum favors holding FLOW slightly overweight. Sending advisory alert to DAO admins.",
  },
];

// ─── Typewriter hook ──────────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 18) {
  const [displayed, setDisplayed] = useState("");
  const prevText = useRef("");

  useEffect(() => {
    if (text === prevText.current) return;
    prevText.current = text;
    setDisplayed("");
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return displayed;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function HermesBrainPanel({
  entries,
  onViewGraph,
}: {
  entries: ReasoningEntry[];
  onViewGraph: () => void;
}) {
  const reasoningEntries = entries.filter(e => e.type === "reasoning");
  const displayEntries = reasoningEntries.length > 0 ? reasoningEntries : DEMO_ENTRIES;
  const latest = displayEntries[0];
  const rest = displayEntries.slice(1, 6);
  const isDemo = reasoningEntries.length === 0;
  const meta = getActionMeta(latest?.action);
  const typed = useTypewriter(latest?.message ?? "", 12);

  return (
    <div style={{
      background: "white",
      border: "1px solid rgba(25,25,24,0.08)",
      borderRadius: 12,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "1rem 1.25rem", borderBottom: "1px solid rgba(25,25,24,0.07)",
        background: "linear-gradient(90deg, rgba(124,58,237,0.04) 0%, rgba(255,255,255,0) 60%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <span style={{ fontSize: "1.1rem" }}>🧠</span>
          <span style={{ fontWeight: 700, fontSize: "0.85rem", letterSpacing: "-0.01em", color: "#191918" }}>
            Hermes Reasoning
          </span>
          {isDemo && (
            <span style={{
              fontSize: "0.55rem", fontFamily: "var(--font-mono, monospace)", textTransform: "uppercase",
              letterSpacing: "0.1em", padding: "0.15rem 0.5rem", borderRadius: 99,
              background: "rgba(124,58,237,0.1)", color: "#7c3aed", fontWeight: 600,
            }}>
              Demo
            </span>
          )}
        </div>
        <button
          onClick={onViewGraph}
          style={{
            display: "flex", alignItems: "center", gap: "0.375rem",
            padding: "0.375rem 0.75rem", borderRadius: 6, cursor: "pointer",
            background: "rgba(25,25,24,0.04)", border: "1px solid rgba(25,25,24,0.1)",
            fontFamily: "var(--font-mono, monospace)", fontSize: "0.65rem",
            fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
            color: "#191918", transition: "all 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(124,58,237,0.08)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,58,237,0.3)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(25,25,24,0.04)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(25,25,24,0.1)"; }}
        >
          <span>View Action Graph</span>
          <span>→</span>
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px" }}>
        {/* Latest reasoning — typewriter */}
        <div style={{ padding: "1.25rem", borderRight: "1px solid rgba(25,25,24,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <span style={{
              padding: "0.2rem 0.6rem", borderRadius: 99, fontSize: "0.6rem",
              fontFamily: "var(--font-mono, monospace)", fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.08em", background: meta.bg, color: meta.color,
            }}>
              {meta.icon} {meta.label}
            </span>
            <span style={{ fontSize: "0.65rem", color: "rgba(25,25,24,0.35)", fontFamily: "var(--font-mono, monospace)" }}>
              {latest?.time}
            </span>
          </div>
          <p style={{
            fontSize: "0.875rem", lineHeight: 1.65, color: "#191918",
            minHeight: "4.5rem", fontStyle: "italic",
          }}>
            "{typed}<span style={{ opacity: 0.3, animation: "blink 1s step-end infinite" }}>|</span>"
          </p>
          <style>{`@keyframes blink { 0%,100%{opacity:0.3} 50%{opacity:0} }`}</style>
        </div>

        {/* Recent decisions log */}
        <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          <p style={{
            fontFamily: "var(--font-mono, monospace)", fontSize: "0.6rem",
            textTransform: "uppercase", letterSpacing: "0.1em",
            color: "rgba(25,25,24,0.35)", marginBottom: "0.125rem",
          }}>
            Previous Decisions
          </p>
          {rest.map(entry => {
            const m = getActionMeta(entry.action);
            return (
              <div key={entry.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <span style={{
                  flexShrink: 0, padding: "0.1rem 0.4rem", borderRadius: 4, fontSize: "0.55rem",
                  fontFamily: "var(--font-mono, monospace)", fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.05em",
                  background: m.bg, color: m.color, marginTop: "0.1rem",
                }}>
                  {m.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: "0.7rem", color: "#191918", lineHeight: 1.4,
                    overflow: "hidden", display: "-webkit-box",
                    WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  }}>
                    {entry.message}
                  </p>
                  <p style={{ fontSize: "0.6rem", color: "rgba(25,25,24,0.3)", fontFamily: "var(--font-mono, monospace)", marginTop: "0.15rem" }}>
                    {entry.time}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
