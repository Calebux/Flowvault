import { NextResponse } from "next/server";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

export async function POST() {
  const state = {
    status: "active",
    startedAt: Date.now(),
    lastTickAt: null,
    totalTrades: 0,
    totalFeesUSD: 0,
    uptime: 0,
  };
  await redis.set("flowvault:agent_state", JSON.stringify(state));

  // In production: spawn/signal the agent-core process
  return NextResponse.json({ success: true, state });
}
