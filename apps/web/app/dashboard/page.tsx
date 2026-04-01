"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AgentStatusCard } from "@/components/AgentStatusCard";
import { ExposureDonut } from "@/components/ExposureDonut";
import { FXRateHeatmap } from "@/components/FXRateHeatmap";
import { TradeTimeline } from "@/components/TradeTimeline";
import { AgentActivityFeed } from "@/components/AgentActivityFeed";
import { YieldOpportunities } from "@/components/YieldOpportunities";
import { HermesBrainPanel, type ReasoningEntry } from "@/components/HermesBrainPanel";
import { ActionGraph } from "@/components/ActionGraph";
interface AgentState {
  status: string;
  startedAt: number | null;
  lastTickAt: number | null;
  totalTrades: number;
  totalFeesUSD: number;
  uptime: number;
}

async function fetchActivity(): Promise<ReasoningEntry[]> {
  const res = await fetch("/api/activity");
  if (!res.ok) return [];
  return res.json();
}

async function fetchStatus(): Promise<AgentState> {
  const res = await fetch("/api/agent/status");
  if (!res.ok) return { status: "stopped", startedAt: null, lastTickAt: null, totalTrades: 0, totalFeesUSD: 0, uptime: 0 };
  return res.json();
}


export default function DashboardPage() {
  const [showGraph, setShowGraph] = useState(false);
  const qc = useQueryClient();

  const { data: activityEntries = [] } = useQuery<ReasoningEntry[]>({
    queryKey: ["activity"],
    queryFn: fetchActivity,
    refetchInterval: 5000,
  });

  return (
    <div className="space-y-6">
      {/* Top row: Status + Portfolio + Next Action */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AgentStatusCard />
        <ExposureDonut />
        <NextActionCard onTriggerTick={() => qc.invalidateQueries({ queryKey: ["activity"] })} />
      </div>

      {/* Hermes Brain Panel — AI reasoning + "View Action Graph" button */}
      <HermesBrainPanel entries={activityEntries} onViewGraph={() => setShowGraph(true)} />

      {/* FX / Price Heatmap */}
      <FXRateHeatmap />

      {/* Bottom row: Timeline + Activity + Yields */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TradeTimeline />
        <AgentActivityFeed />
        <YieldOpportunities />
      </div>

      {/* Action Graph modal */}
      {showGraph && (
        <ActionGraph entries={activityEntries} onClose={() => setShowGraph(false)} />
      )}
    </div>
  );
}

// ─── Live NextActionCard ──────────────────────────────────────────────────────

function NextActionCard({ onTriggerTick }: { onTriggerTick: () => void }) {
  const qc = useQueryClient();
  const [countdown, setCountdown] = useState<number | null>(null);
  const [driftSummary, setDriftSummary] = useState<string>("—");

  const { data: agentState } = useQuery<AgentState>({
    queryKey: ["agent-status"],
    queryFn: fetchStatus,
    refetchInterval: 3000,
  });

  const { data: activityEntries = [] } = useQuery<ReasoningEntry[]>({
    queryKey: ["activity"],
    queryFn: fetchActivity,
    refetchInterval: 5000,
  });

  // Countdown to next tick (15s interval)
  useEffect(() => {
    if (!agentState?.lastTickAt) {
      setCountdown(null);
      return;
    }
    const INTERVAL = 15;
    const update = () => {
      const elapsedSec = (Date.now() - agentState.lastTickAt!) / 1000;
      const remaining = Math.max(0, INTERVAL - (elapsedSec % INTERVAL));
      setCountdown(Math.round(remaining));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [agentState?.lastTickAt]);

  // Extract drift from activity feed
  useEffect(() => {
    const tickEntry = activityEntries.find(e => e.id?.startsWith("tick-"));
    if (!tickEntry) {
      setDriftSummary("—");
      return;
    }
    const match = tickEntry.message?.match(/drift:\s*(.+)/);
    if (match) {
      // Shorten: "FLOW +5.2%, USDC -5.2%, USDT -0.1%, stFLOW +0.1%" → "FLOW +5.2%"
      const parts = match[1].split(",").map(s => s.trim());
      const nonZero = parts.filter(p => !p.match(/[+-]0\.0%/));
      setDriftSummary(nonZero.length ? nonZero[0] : "< 0.1%");
    } else if (tickEntry.message?.includes("balanced")) {
      setDriftSummary("< 0.1%");
    } else {
      setDriftSummary("—");
    }
  }, [activityEntries]);

  const triggerTick = useMutation({
    mutationFn: () => fetch("/api/agent/tick", { method: "POST" }).then(r => r.json()),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["activity"] });
      qc.invalidateQueries({ queryKey: ["agent-status"] });
      onTriggerTick();
    },
  });

  const isActive = agentState?.status === "active";
  const isTicking = triggerTick.isPending;

  const countdownStr = countdown !== null
    ? `0:${String(countdown).padStart(2, "0")}`
    : "—";

  const statusColor = isActive ? "#16a34a" : "#ef4444";
  const statusText = isActive ? "OK" : "PAUSED";

  return (
    <div className="m-card">
      <p className="m-label" style={{ marginBottom: "1rem" }}>Next Action</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <p style={{ fontWeight: 600, color: "#191918" }}>
          {isTicking ? "Hermes deciding…" : isActive ? "Monitoring…" : "Agent Paused"}
        </p>
        {[
          ["Next check", isActive ? countdownStr : "—"],
          ["Max drift", driftSummary],
          ["Status", statusText],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(25,25,24,0.07)", paddingBottom: "0.375rem" }}>
            <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.7rem", color: "rgba(25,25,24,0.45)" }}>{k}</span>
            <span style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "0.7rem",
              fontWeight: 700,
              color: k === "Status" ? statusColor : "#191918",
            }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Manual tick trigger for demo */}
      <button
        onClick={() => triggerTick.mutate()}
        disabled={isTicking}
        style={{
          marginTop: "0.875rem",
          width: "100%",
          padding: "0.5rem",
          borderRadius: 6,
          fontSize: "0.65rem",
          fontFamily: "var(--font-mono, monospace)",
          fontWeight: 600,
          textTransform: "uppercase" as const,
          letterSpacing: "0.05em",
          cursor: isTicking ? "default" : "pointer",
          background: isTicking ? "rgba(25,25,24,0.04)" : "rgba(252,170,45,0.08)",
          color: isTicking ? "rgba(25,25,24,0.35)" : "#191918",
          border: `1px solid ${isTicking ? "rgba(25,25,24,0.08)" : "rgba(252,170,45,0.25)"}`,
          transition: "all 0.15s",
        }}
      >
        {isTicking ? "⏳ Asking Hermes…" : "⚡ Trigger AI Tick"}
      </button>
    </div>
  );
}
