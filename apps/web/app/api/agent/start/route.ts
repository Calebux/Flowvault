import { NextResponse } from "next/server";
import redis from "@/lib/redis";
import { startScheduler } from "@/lib/agent-scheduler";

export async function POST() {
  const now = Date.now();
  const state = {
    status: "active",
    startedAt: now,
    lastTickAt: null,
    totalTrades: 0,
    totalFeesUSD: 0,
    uptime: 0,
  };
  await redis.set("flowvault:agent_state", JSON.stringify(state));

  // Start the in-process scheduler — fires a Hermes tick every 30s
  startScheduler(30_000);

  return NextResponse.json({ success: true, state });
}
