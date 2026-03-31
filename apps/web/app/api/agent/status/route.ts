import { NextResponse } from "next/server";
import redis from "@/lib/redis";

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
