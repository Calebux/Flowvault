import { NextResponse } from "next/server";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

const DEMO_YIELDS = {
  USDC: [
    { protocol: "IncrementFi",   symbol: "USDC", apy: 4.87, tvlUsd: 2_340_000 },
    { protocol: "Sturdy Finance", symbol: "USDC", apy: 3.94, tvlUsd:   890_000 },
    { protocol: "Celer cBridge", symbol: "USDC", apy: 2.21, tvlUsd:   450_000 },
  ],
  USDT: [
    { protocol: "IncrementFi",   symbol: "USDT", apy: 4.52, tvlUsd: 1_120_000 },
    { protocol: "Sturdy Finance", symbol: "USDT", apy: 3.71, tvlUsd:   540_000 },
  ],
  updatedAt: 0,
};

export async function GET() {
  try {
    const cached = await redis.get("flowvault:yield_rates");
    if (cached) {
      const parsed = JSON.parse(cached);
      const hasData = parsed.USDC?.length > 0 || parsed.USDT?.length > 0;
      if (hasData) return NextResponse.json(parsed);
    }
    return NextResponse.json({ ...DEMO_YIELDS, updatedAt: Date.now(), source: "demo" });
  } catch {
    return NextResponse.json({ ...DEMO_YIELDS, updatedAt: Date.now(), source: "demo" });
  }
}
