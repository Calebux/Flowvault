import { NextResponse } from "next/server";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

export async function POST() {
  const raw = await redis.get("mentoguard:agent_state");
  const current = raw ? JSON.parse(raw) : {};
  const state = { ...current, status: "stopped" };
  await redis.set("mentoguard:agent_state", JSON.stringify(state));
  return NextResponse.json({ success: true, state });
}
