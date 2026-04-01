import { NextResponse } from "next/server";
import redis from "@/lib/redis";

const ACTION_LABELS: Record<string, string> = {
  execute_swap:        "Rebalance Swap",
  deposit_to_yield:    "Yield Deposit",
  withdraw_from_yield: "Yield Withdrawal",
  reserve_expense:     "Expense Reserve",
  send_alert:          "Alert Sent",
  blocked_by_guardrail:"Guardrail Block",
  hold:                "Hold — No Action",
};

export async function GET() {
  try {
    // Primary: reasoning_log entries (written by every tick, always available)
    const logEntries = await redis.lrange("flowvault:reasoning_log", 0, 29);

    if (logEntries.length > 0) {
      const decisions = logEntries.map((raw, i) => {
        const r = JSON.parse(raw) as {
          text: string;
          action: string;
          timestamp: number;
          filecoinCid?: string | null;
        };
        return {
          id: `decision-${r.timestamp ?? i}`,
          timestamp: r.timestamp ?? Date.now() - i * 60_000,
          action: r.action ?? "hold",
          actionLabel: ACTION_LABELS[r.action] ?? r.action,
          reasoning: r.text ?? "",
          filecoinCid: r.filecoinCid ?? null,
        };
      });
      return NextResponse.json({ decisions });
    }

    // Fallback: demo decisions seeded by /api/seed-demo
    const demoRaw = await redis.get("flowvault:demo_trades");
    if (demoRaw) {
      const demoTrades = JSON.parse(demoRaw) as Array<{
        id: string;
        timestamp: number;
        fromToken: string;
        toToken: string;
        reasoning: string;
        filecoinCid?: string;
      }>;
      const decisions = demoTrades.map(t => ({
        id: t.id,
        timestamp: t.timestamp,
        action: "execute_swap",
        actionLabel: `Rebalance — ${t.fromToken} → ${t.toToken}`,
        reasoning: t.reasoning ?? "",
        filecoinCid: t.filecoinCid ?? null,
      }));
      return NextResponse.json({ decisions });
    }

    return NextResponse.json({ decisions: [] });
  } catch {
    return NextResponse.json({ decisions: [] });
  }
}
