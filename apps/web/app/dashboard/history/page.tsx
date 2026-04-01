"use client";

import { useQuery } from "@tanstack/react-query";

interface Decision {
  id: string;
  timestamp: number;
  action: string;
  actionLabel: string;
  reasoning: string;
  filecoinCid: string | null;
}

const ACTION_COLOR: Record<string, string> = {
  execute_swap:         "#16a34a",
  deposit_to_yield:     "#2563eb",
  withdraw_from_yield:  "#7c3aed",
  reserve_expense:      "#d97706",
  send_alert:           "#c48c5a",
  blocked_by_guardrail: "#dc2626",
  hold:                 "rgba(25,25,24,0.35)",
};

export default function HistoryPage() {
  const { data, isLoading } = useQuery<{ decisions: Decision[] }>({
    queryKey: ["ai-history"],
    queryFn: async () => {
      const res = await fetch("/api/history");
      if (!res.ok) return { decisions: [] };
      return res.json();
    },
    refetchInterval: 15_000,
  });

  const decisions = data?.decisions ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.25rem" }}>AI Decision Log</h1>
        <p style={{ fontSize: "0.75rem", color: "rgba(25,25,24,0.45)", fontFamily: "var(--font-mono, monospace)" }}>
          Every Hermes decision is logged here. When LIGHTHOUSE_API_KEY is configured, each entry
          is uploaded to Filecoin via Lighthouse — permanent, verifiable, tamper-proof.
        </p>
      </div>

      <div className="m-card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "140px 160px 1fr 130px",
          gap: "0 1rem",
          padding: "0.6rem 1rem",
          borderBottom: "1px solid rgba(25,25,24,0.08)",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "0.6rem",
          color: "rgba(25,25,24,0.35)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}>
          <span>Time</span>
          <span>Action</span>
          <span>Hermes Reasoning</span>
          <span>Filecoin CID</span>
        </div>

        {isLoading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "rgba(25,25,24,0.3)", fontFamily: "var(--font-mono, monospace)", fontSize: "0.7rem" }}>
            Loading...
          </div>
        ) : decisions.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "rgba(25,25,24,0.3)", fontFamily: "var(--font-mono, monospace)", fontSize: "0.7rem" }}>
            No decisions yet — click ⚡ Trigger AI Tick on the dashboard to generate the first entry.
          </div>
        ) : (
          decisions.map((d, i) => (
            <div
              key={d.id}
              style={{
                display: "grid",
                gridTemplateColumns: "140px 160px 1fr 130px",
                gap: "0 1rem",
                padding: "0.75rem 1rem",
                borderBottom: i < decisions.length - 1 ? "1px solid rgba(25,25,24,0.05)" : "none",
                alignItems: "start",
              }}
            >
              <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.65rem", color: "rgba(25,25,24,0.4)", paddingTop: "0.1rem" }}>
                {new Date(d.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              <span style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "0.65rem",
                fontWeight: 700,
                color: ACTION_COLOR[d.action] ?? "rgba(25,25,24,0.6)",
                paddingTop: "0.1rem",
              }}>
                {d.actionLabel}
              </span>
              <span style={{ fontSize: "0.7rem", color: "rgba(25,25,24,0.65)", lineHeight: 1.5 }}>
                {d.reasoning}
              </span>
              <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.6rem", paddingTop: "0.1rem" }}>
                {d.filecoinCid ? (
                  <a
                    href={`https://gateway.lighthouse.storage/ipfs/${d.filecoinCid}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#2563eb", textDecoration: "none" }}
                    title={d.filecoinCid}
                  >
                    {d.filecoinCid.slice(0, 14)}…
                    <span style={{ marginLeft: "0.25rem", opacity: 0.5 }}>↗</span>
                  </a>
                ) : (
                  <span style={{ color: "rgba(25,25,24,0.2)" }}>— no key set</span>
                )}
              </span>
            </div>
          ))
        )}
      </div>

      {decisions.length > 0 && (
        <p style={{ fontSize: "0.65rem", color: "rgba(25,25,24,0.3)", fontFamily: "var(--font-mono, monospace)" }}>
          {decisions.length} decision{decisions.length !== 1 ? "s" : ""} recorded
          {decisions.filter(d => d.filecoinCid).length > 0 && (
            <> · {decisions.filter(d => d.filecoinCid).length} uploaded to Filecoin</>
          )}
        </p>
      )}
    </div>
  );
}
