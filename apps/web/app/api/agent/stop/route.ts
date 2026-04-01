import { NextResponse } from "next/server";
import redis from "@/lib/redis";
import { stopScheduler } from "@/lib/agent-scheduler";

export async function POST() {
  stopScheduler();

  try {
    const raw = await redis.get("flowvault:agent_state");
    const current = raw ? JSON.parse(raw) : {};
    await redis.set("flowvault:agent_state", JSON.stringify({ ...current, status: "stopped" }));
  } catch { /* ignore */ }

  return NextResponse.json({ success: true, state: { status: "stopped" } });
}
