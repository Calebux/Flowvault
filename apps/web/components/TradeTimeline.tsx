"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useTradeHistory } from "@/hooks/useTradeHistory";

export function TradeTimeline() {
  const { trades } = useTradeHistory();

  const chartData = trades.slice(0, 10).reverse().map((t) => ({
    time: new Date(t.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    amount: parseFloat(t.fromAmount),
  }));

  return (
    <div className="m-card">
      <p className="m-label" style={{ marginBottom: "1rem" }}>Trade Timeline</p>
      {chartData.length === 0 ? (
        <div style={{ height: 128, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(25,25,24,0.35)", fontSize: "0.8rem" }}>
          No trades yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="tradeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#FCAA2D" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#FCAA2D" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" tick={{ fill: "rgba(25,25,24,0.35)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis                tick={{ fill: "rgba(25,25,24,0.35)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#FFFEF2", border: "1px solid rgba(25,25,24,0.12)", borderRadius: 8, fontSize: "0.75rem" }}
              labelStyle={{ color: "rgba(25,25,24,0.5)" }}
            />
            <Area type="monotone" dataKey="amount" stroke="#FCAA2D" fill="url(#tradeGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
