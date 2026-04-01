import { NextResponse } from "next/server";
import redis from "@/lib/redis";
import { startScheduler } from "@/lib/agent-scheduler";

export async function POST() {
  // Always start the scheduler — this is the source of truth for agent running state
  startScheduler(30_000);

  const now = Date.now();
  const state = { status: "active", startedAt: now, lastTickAt: null, totalTrades: 0, totalFeesUSD: 0, uptime: 0 };

  // Redis write is best-effort — scheduler runs regardless
  try { await redis.set("flowvault:agent_state", JSON.stringify(state)); } catch { /* ignore */ }

  return NextResponse.json({ success: true, state });
}
