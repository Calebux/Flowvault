import { NextResponse } from "next/server";
import redis from "@/lib/redis";

export async function GET() {
  try {
    const [tickRaw, stateRaw, logEntries] = await Promise.all([
      redis.get("flowvault:last_tick"),
      redis.get("flowvault:agent_state"),
      redis.lrange("flowvault:reasoning_log", 0, 19),
    ]);

    const entries: { id: string; time: string; message: string; type: string; action?: string }[] = [];

    // Agent state summary
    if (stateRaw) {
      const state = JSON.parse(stateRaw);
      if (state.lastTickAt) {
        entries.push({
          id: `state-${state.lastTickAt}`,
          time: new Date(state.lastTickAt).toLocaleTimeString(),
          message: `Agent active — ${state.totalTrades} trades, uptime ${Math.floor(state.uptime / 60)}m`,
          type: "info",
        });
      }
    }

    // Latest tick drift info
    if (tickRaw) {
      const tick = JSON.parse(tickRaw);
      const time = new Date(tick.tickAt).toLocaleTimeString();
      const drifts = Object.entries(tick.drift as Record<string, number>)
        .filter(([, v]) => Math.abs(v) > 0.1)
        .map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v.toFixed(1)}%`)
        .join(", ");

      if (tick.shouldRebalance) {
        entries.unshift({ id: `tick-warn-${tick.tickAt}`, time, message: `Drift exceeded threshold — ${drifts}`, type: "warning" });
      } else if (drifts) {
        entries.unshift({ id: `tick-info-${tick.tickAt}`, time, message: `Treasury tick — drift: ${drifts}`, type: "info" });
      } else {
        entries.unshift({ id: `tick-ok-${tick.tickAt}`, time, message: "Treasury tick complete — allocation balanced", type: "info" });
      }
    }

    // Rolling reasoning log (newest first from Redis LPUSH)
    for (const raw of logEntries) {
      const r = JSON.parse(raw);
      const isBlocked = r.action === "blocked_by_guardrail";
      const isSwap    = r.action === "execute_swap";
      entries.push({
        id: `reasoning-${r.timestamp}`,
        time: new Date(r.timestamp).toLocaleTimeString(),
        message: (isBlocked ? "🛡️ " : isSwap ? "🔄 " : "") + r.text,
        type: isBlocked ? "error" : isSwap ? "success" : "reasoning",
        action: r.action,
      });
    }

    return NextResponse.json(entries);
  } catch {
    return NextResponse.json([]);
  }
}
