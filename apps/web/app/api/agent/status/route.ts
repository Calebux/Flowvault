import { NextResponse } from "next/server";
import redis from "@/lib/redis";
import { isSchedulerRunning } from "@/lib/agent-scheduler";

export async function GET() {
  // Scheduler is source of truth — if it's running in this process, agent is active
  const schedulerActive = isSchedulerRunning();

  let state: Record<string, unknown> = {};
  try {
    const raw = await redis.get("flowvault:agent_state");
    if (raw) state = JSON.parse(raw);
  } catch { /* ignore */ }

  return NextResponse.json({
    status:       schedulerActive ? "active" : (state.status ?? "stopped"),
    startedAt:    state.startedAt    ?? null,
    lastTickAt:   state.lastTickAt   ?? null,
    totalTrades:  state.totalTrades  ?? 0,
    totalFeesUSD: state.totalFeesUSD ?? 0,
    uptime:       state.uptime       ?? 0,
  });
}
