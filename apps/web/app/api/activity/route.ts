import { NextResponse } from "next/server";
import redis from "@/lib/redis";

// ── Hardcoded demo entries — shown when Redis is empty ────────────────────────
function getDemoEntries() {
  const now = Date.now();
  return [
    { id: "demo-1", time: new Date(now - 2 * 3600_000).toLocaleTimeString(), message: "🔄 FLOW has drifted +11.4% above its 25% target, exceeding the 5% threshold. Checking expense schedule: Q2 payroll of $45,000 USDC due in 32 days — stable reserve adequate. Executing FLOW→USDC rebalance.", type: "success", action: "execute_swap" },
    { id: "demo-2", time: new Date(now - 110 * 60_000).toLocaleTimeString(), message: "Idle USDC balance of $52,000 detected. Deploying 80% ($41,600) to IncrementFi USDC vault at 4.87% APY. Keeping 20% liquid for gas.", type: "reasoning", action: "deposit_to_yield" },
    { id: "demo-3", time: new Date(now - 95 * 60_000).toLocaleTimeString(), message: "All allocations within 5% threshold. FLOW +0.3%, USDC -0.2%. Yield positions earning 4.87% APY on $52k. Holding.", type: "reasoning", action: "hold" },
    { id: "demo-4", time: new Date(now - 7 * 3600_000).toLocaleTimeString(), message: "🔄 Second daily rebalance: USDC→stFLOW $249.87. All 6 delegation rules satisfied. DAO treasury below multi-sig threshold.", type: "success", action: "execute_swap" },
    { id: "demo-5", time: new Date(now - 4 * 3600_000).toLocaleTimeString(), message: "Initial scan: $841,760 across 4 tokens. FLOW drifted +10.8%. Expenses loaded: Q2 Payroll $45k (32d), Audit $25k (58d), Grants $15k (75d). Agent monitoring initialized.", type: "info", action: "hold" },
  ];
}

export async function GET() {
  try {
    const [tickRaw, stateRaw, logEntries] = await Promise.all([
      redis.get("flowvault:last_tick").catch(() => null),
      redis.get("flowvault:agent_state").catch(() => null),
      redis.lrange("flowvault:reasoning_log", 0, 19).catch(() => [] as string[]),
    ]);

    const entries: { id: string; time: string; message: string; type: string; action?: string }[] = [];

    // Agent state summary
    if (stateRaw) {
      try {
        const state = JSON.parse(stateRaw);
        if (state.lastTickAt) {
          entries.push({
            id: `state-${state.lastTickAt}`,
            time: new Date(state.lastTickAt).toLocaleTimeString(),
            message: `Agent active — ${state.totalTrades ?? 0} trades, uptime ${Math.floor((state.uptime ?? 0) / 60)}m`,
            type: "info",
          });
        }
      } catch { /* ignore */ }
    }

    // Latest tick drift info
    if (tickRaw) {
      try {
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
      } catch { /* ignore */ }
    }

    // Rolling reasoning log
    for (const raw of logEntries) {
      try {
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
      } catch { /* ignore */ }
    }

    // If Redis had nothing, return hardcoded demo entries
    if (entries.length === 0) return NextResponse.json(getDemoEntries());

    return NextResponse.json(entries);
  } catch {
    return NextResponse.json(getDemoEntries());
  }
}
