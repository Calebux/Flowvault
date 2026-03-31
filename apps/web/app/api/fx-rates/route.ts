import { NextResponse } from "next/server";
import Redis from "ioredis";
import type { FXRates } from "@mentoguard/shared";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

async function fetchFromForex(): Promise<FXRates> {
  const res = await fetch(
    "https://api.frankfurter.app/latest?base=USD&symbols=EUR,BRL",
    { next: { revalidate: 60 } }
  );
  if (!res.ok) throw new Error(`Frankfurter API error: ${res.status}`);
  const data = (await res.json()) as { rates: { EUR: number; BRL: number } };
  const eurUSD = 1 / data.rates.EUR;
  const brlUSD = 1 / data.rates.BRL;
  return {
    cUSD:  1.0,
    cEUR:  eurUSD,
    cBRL:  brlUSD,
    cREAL: brlUSD,
    CELO:  0.5, // fallback price; agent-core will overwrite with live CoinGecko price
    updatedAt: Date.now(),
  };
}

export async function GET() {
  try {
    // Agent-core writes this every 60s
    const cached = await redis.get("mentoguard:fx_rates");
    if (cached) return NextResponse.json(JSON.parse(cached));

    // Fallback: fetch directly from forex API
    const rates = await fetchFromForex();
    return NextResponse.json(rates);
  } catch (err) {
    console.error("[api/fx-rates]", err);
    const fallback: FXRates = { cUSD: 1.0, cEUR: 1.08, cBRL: 0.2, cREAL: 0.18, CELO: 0.5, updatedAt: Date.now() };
    return NextResponse.json(fallback);
  }
}
