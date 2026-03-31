import { NextResponse } from "next/server";
import redis from "@/lib/redis";

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

  // Fire a real AI tick immediately so the dashboard shows activity right away.
  // This runs async — we return to the client immediately.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  fetch(`${appUrl}/api/agent/tick`, { method: "POST" }).catch(() => {});

  return NextResponse.json({ success: true, state });
}
