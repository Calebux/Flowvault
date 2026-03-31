"use client";

import { useFXRates } from "@/hooks/useFXRates";

const TOKENS = ["cUSD", "cEUR", "cBRL", "cREAL", "CELO"] as const;
const PREV_RATES: Record<string, number> = { cUSD: 1.0, cEUR: 1.075, cBRL: 0.198, cREAL: 0.179, CELO: 0.50 };

export function FXRateHeatmap() {
  const { rates, isLoading } = useFXRates();

  return (
    <div className="m-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <p className="m-label">FX Rate Heatmap</p>
        <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.65rem", color: "rgba(25,25,24,0.35)" }}>
          {rates ? new Date(rates.updatedAt).toLocaleTimeString() : "—"}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "0.75rem" }}>
        {TOKENS.map((token) => {
          const rate   = rates?.[token] ?? 0;
          const prev   = PREV_RATES[token] ?? rate;
          const change = ((rate - prev) / prev) * 100;
          const isUp   = change >= 0;
          return (
            <div key={token} style={{
              borderRadius: 8, padding: "0.75rem", textAlign: "center", border: "1px solid",
              borderColor: isLoading ? "rgba(25,25,24,0.08)" : isUp ? "rgba(40,200,64,0.25)" : "rgba(239,68,68,0.2)",
              background:  isLoading ? "transparent" : isUp ? "rgba(40,200,64,0.04)" : "rgba(239,68,68,0.04)",
            }}>
              <p style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.6rem", color: "rgba(25,25,24,0.4)", marginBottom: "0.25rem" }}>{token}</p>
              <p style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 700, fontSize: "0.95rem" }}>
                {isLoading ? "—" : rate.toFixed(4)}
              </p>
              {!isLoading && (
                <p style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.65rem", marginTop: "0.25rem", color: isUp ? "#16a34a" : "#ef4444" }}>
                  {isUp ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
