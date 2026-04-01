import { NextResponse } from "next/server";
import redis from "@/lib/redis";
import { stopScheduler } from "@/lib/agent-scheduler";

export async function POST() {
  stopScheduler();
  const raw = await redis.get("flowvault:agent_state");
  const current = raw ? JSON.parse(raw) : {};
  const state = { ...current, status: "stopped" };
  await redis.set("flowvault:agent_state", JSON.stringify(state));
  return NextResponse.json({ success: true, state });
}
