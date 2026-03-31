"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { usePortfolio } from "@/hooks/usePortfolio";

const COLORS: Record<string, string> = {
  FLOW:   "#00EF8B", // Flow brand green
  USDC:   "#2775CA", // USDC blue
  USDT:   "#26A17B", // USDT teal
  stFLOW: "#0052FF", // stFLOW blue
};

export function ExposureDonut() {
  const { balances, totalUSD, isLoading } = usePortfolio();

  const data = balances.map((b) => ({
    name: b.token,
    value: b.balanceUSD,
    pct: totalUSD > 0 ? ((b.balanceUSD / totalUSD) * 100).toFixed(1) : "0",
  }));

  return (
    <div className="m-card">
      <p className="m-label" style={{ marginBottom: "1rem" }}>Portfolio Exposure</p>
      {isLoading ? (
        <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(25,25,24,0.35)", fontSize: "0.8rem" }}>
          Loading…
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={3} dataKey="value">
              {data.map((entry) => (
                <Cell key={entry.name} fill={COLORS[entry.name] ?? "#ccc"} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number, name: string) => [`$${v.toFixed(2)}`, name]}
              contentStyle={{ background: "#FFFEF2", border: "1px solid rgba(25,25,24,0.12)", borderRadius: 8, fontSize: "0.75rem" }}
            />
            <Legend formatter={(name) => { const d = data.find((e) => e.name === name); return `${name} ${d?.pct}%`; }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
