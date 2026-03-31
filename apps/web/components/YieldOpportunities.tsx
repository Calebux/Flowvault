"use client";

import { useEffect, useState } from "react";

interface YieldOpp { protocol: string; symbol: string; apy: number; tvlUsd: number; }
interface YieldRates { USDC: YieldOpp[]; USDT: YieldOpp[]; updatedAt: number; }

export function YieldOpportunities() {
  const [yields, setYields] = useState<YieldRates | null>(null);

  useEffect(() => {
    fetch("/api/yields").then(r => r.json()).then(setYields).catch(() => {});
    const id = setInterval(() => {
      fetch("/api/yields").then(r => r.json()).then(setYields).catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const all = [
    ...(yields?.USDC ?? []).map(o => ({ ...o, token: "USDC" })),
    ...(yields?.USDT ?? []).map(o => ({ ...o, token: "USDT" })),
  ].sort((a, b) => b.apy - a.apy).slice(0, 4);

  return (
    <div className="m-card">
      <p className="m-label" style={{ marginBottom: "1rem" }}>Yield Opportunities</p>
      {all.length === 0 ? (
        <span style={{ fontSize: "0.75rem", color: "rgba(25,25,24,0.35)" }}>Fetching Flow DeFi yields…</span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {all.map((o, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem", borderRadius: 8, background: "rgba(252,170,45,0.06)", border: "1px solid rgba(252,170,45,0.15)" }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>{o.token}</span>
                <span style={{ fontSize: "0.72rem", color: "rgba(25,25,24,0.45)", marginLeft: "0.5rem" }}>{o.protocol} · {o.symbol}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 700, color: "#16a34a", fontSize: "0.9rem" }}>{o.apy.toFixed(2)}%</span>
                <span style={{ display: "block", fontSize: "0.65rem", color: "rgba(25,25,24,0.35)" }}>APY · ${(o.tvlUsd / 1000).toFixed(0)}k TVL</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: "0.65rem", color: "rgba(25,25,24,0.3)", marginTop: "0.75rem" }}>
        Sourced from DeFiLlama · Hermes considers these when deciding to hold or rebalance
      </p>
    </div>
  );
}
