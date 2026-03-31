import { NextResponse } from "next/server";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

export async function GET() {
  try {
    const cached = await redis.get("mentoguard:yield_rates");
    if (cached) return NextResponse.json(JSON.parse(cached));
    return NextResponse.json({ cUSD: [], cEUR: [], updatedAt: Date.now() });
  } catch {
    return NextResponse.json({ cUSD: [], cEUR: [], updatedAt: Date.now() });
  }
}
