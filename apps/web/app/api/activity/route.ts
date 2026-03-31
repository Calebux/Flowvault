import { NextResponse } from "next/server";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

export async function GET() {
  try {
    const [tickRaw, stateRaw, reasoningRaw] = await Promise.all([
      redis.get("flowvault:last_tick"),
      redis.get("flowvault:agent_state"),
      redis.get("flowvault:last_reasoning"),
    ]);

    const entries: { id: string; time: string; message: string; type: string }[] = [];

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
        entries.unshift({ id: `tick-info-${tick.tickAt}`, time, message: `FX tick — drift: ${drifts}`, type: "info" });
      } else {
        entries.unshift({ id: `tick-ok-${tick.tickAt}`, time, message: "FX tick complete — portfolio balanced", type: "info" });
      }
    }

    if (reasoningRaw) {
      const r = JSON.parse(reasoningRaw);
      entries.push({
        id: `reasoning-${r.timestamp}`,
        time: new Date(r.timestamp).toLocaleTimeString(),
        message: `🧠 Hermes: ${r.text}`,
        type: "reasoning",
      });
    }

    return NextResponse.json(entries);
  } catch {
    return NextResponse.json([]);
  }
}
