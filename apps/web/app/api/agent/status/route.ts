import { NextResponse } from "next/server";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

export async function GET() {
  const raw = await redis.get("flowvault:agent_state");
  if (!raw) {
    return NextResponse.json({
      status: "stopped",
      startedAt: null,
      lastTickAt: null,
      totalTrades: 0,
      totalFeesUSD: 0,
      uptime: 0,
    });
  }
  return NextResponse.json(JSON.parse(raw));
}
