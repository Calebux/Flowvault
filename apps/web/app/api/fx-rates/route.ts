import { NextResponse } from "next/server";
import type { FXRates } from "@flowvault/shared";

import redis from "@/lib/redis";

const FLOW_PRICE_FALLBACK: FXRates = {
  FLOW:   0.5,
  USDC:   1.0,
  USDT:   1.0,
  stFLOW: 0.525,
  updatedAt: Date.now(),
};

export async function GET() {
  try {
    // Agent-core writes this key every 60s via Pyth oracle
    const cached = await redis.get("flowvault:token_prices");
    if (cached) return NextResponse.json(JSON.parse(cached));

    // Fallback: return hardcoded prices until agent writes live data
    return NextResponse.json(FLOW_PRICE_FALLBACK);
  } catch (err) {
    console.error("[api/fx-rates]", err);
    return NextResponse.json(FLOW_PRICE_FALLBACK);
  }
}
