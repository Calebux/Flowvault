import { NextResponse } from "next/server";
import Redis from "ioredis";
import { DEFAULT_DELEGATION_RULES } from "@mentoguard/shared";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

export async function GET() {
  const raw = await redis.get("mentoguard:delegation_rules");
  return NextResponse.json(raw ? JSON.parse(raw) : DEFAULT_DELEGATION_RULES);
}

export async function POST(req: Request) {
  const rules = await req.json();
  await redis.set("mentoguard:delegation_rules", JSON.stringify(rules));
  return NextResponse.json({ success: true });
}
