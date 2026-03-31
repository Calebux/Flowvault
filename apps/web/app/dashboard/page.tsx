"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AgentStatusCard } from "@/components/AgentStatusCard";
import { ExposureDonut } from "@/components/ExposureDonut";
import { FXRateHeatmap } from "@/components/FXRateHeatmap";
import { TradeTimeline } from "@/components/TradeTimeline";
import { AgentActivityFeed } from "@/components/AgentActivityFeed";
import { YieldOpportunities } from "@/components/YieldOpportunities";
import { HermesBrainPanel, type ReasoningEntry } from "@/components/HermesBrainPanel";
import { ActionGraph } from "@/components/ActionGraph";

async function fetchActivity(): Promise<ReasoningEntry[]> {
  const res = await fetch("/api/activity");
  if (!res.ok) return [];
  return res.json();
}

export default function DashboardPage() {
  const [showGraph, setShowGraph] = useState(false);

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
        <NextActionCard />
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

function NextActionCard() {
  return (
    <div className="m-card">
      <p className="m-label" style={{ marginBottom: "1rem" }}>Next Action</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <p style={{ fontWeight: 600, color: "#191918" }}>Monitoring…</p>
        {[["Next check", "0:42"], ["Drift", "2.1%"], ["Status", "OK"]].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(25,25,24,0.07)", paddingBottom: "0.375rem" }}>
            <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.7rem", color: "rgba(25,25,24,0.45)" }}>{k}</span>
            <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.7rem", fontWeight: 700, color: k === "Status" ? "#16a34a" : "#191918" }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
