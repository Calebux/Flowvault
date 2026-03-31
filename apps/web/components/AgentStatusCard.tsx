"use client";

import { motion } from "framer-motion";
import { useAgentStatus } from "@/hooks/useAgentStatus";
import { formatUptime } from "@mentoguard/shared";

export function AgentStatusCard() {
  const { status, start, stop } = useAgentStatus();
  const isActive = status?.status === "active";

  return (
    <div className="m-card">
      <p className="m-label" style={{ marginBottom: "1rem" }}>Agent Status</p>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <motion.div
          style={{ width: 8, height: 8, borderRadius: "50%", background: isActive ? "#28C840" : "#ef4444" }}
          animate={isActive ? { opacity: [1, 0.3, 1] } : {}}
          transition={{ repeat: Infinity, duration: 1.5 }}
        />
        <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 700, fontSize: "1rem", color: isActive ? "#191918" : "#ef4444" }}>
          {status?.status?.toUpperCase() ?? "LOADING"}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginBottom: "1.25rem" }}>
        {[
          ["Uptime",  formatUptime(status?.uptime ?? 0)],
          ["Trades",  String(status?.totalTrades ?? 0)],
          ["Fees",    `$${(status?.totalFeesUSD ?? 0).toFixed(4)}`],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(25,25,24,0.07)", paddingBottom: "0.375rem" }}>
            <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.7rem", color: "rgba(25,25,24,0.45)" }}>{k}</span>
            <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.7rem", fontWeight: 700 }}>{v}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => isActive ? stop() : start()}
        style={{
          width: "100%", padding: "0.625rem", borderRadius: 6, fontSize: "0.7rem",
          fontFamily: "var(--font-mono, monospace)", fontWeight: 600, textTransform: "uppercase",
          letterSpacing: "0.05em", cursor: "pointer", transition: "opacity 0.2s",
          background: isActive ? "rgba(239,68,68,0.08)" : "rgba(252,170,45,0.12)",
          color: isActive ? "#ef4444" : "#191918",
          border: `1px solid ${isActive ? "rgba(239,68,68,0.2)" : "rgba(252,170,45,0.3)"}`,
        }}
      >
        {isActive ? "Pause Agent" : "Start Agent"}
      </button>
    </div>
  );
}
