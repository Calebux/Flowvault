import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

export interface YieldOpportunity {
  protocol: string;
  symbol: string;
  apy: number;
  tvlUsd: number;
}

export interface YieldRates {
  cUSD: YieldOpportunity[];
  cEUR: YieldOpportunity[];
  updatedAt: number;
}

export async function fetchYieldRates(): Promise<YieldRates> {
  try {
    const res = await fetch("https://yields.llama.fi/pools", {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`DeFiLlama error: ${res.status}`);
    const data = await res.json() as { data: Record<string, unknown>[] };

    const celoPools = data.data.filter((p) =>
      (p.chain as string) === "Celo" &&
      typeof p.apy === "number" && (p.apy as number) > 0 &&
      typeof p.tvlUsd === "number" && (p.tvlUsd as number) > 500
    );

    const pick = (keyword: string): YieldOpportunity[] =>
      celoPools
        .filter((p) => (p.symbol as string).toLowerCase().includes(keyword))
        .map((p) => ({
          protocol: p.project as string,
          symbol: p.symbol as string,
          apy: Math.round((p.apy as number) * 100) / 100,
          tvlUsd: p.tvlUsd as number,
        }))
        .sort((a, b) => b.apy - a.apy)
        .slice(0, 3);

    const rates: YieldRates = {
      cUSD: pick("cusd"),
      cEUR: pick("ceur"),
      updatedAt: Date.now(),
    };

    await redis.set("mentoguard:yield_rates", JSON.stringify(rates), "EX", 300);

    const bestCUSD = rates.cUSD[0]?.apy ?? 0;
    const bestCEUR = rates.cEUR[0]?.apy ?? 0;
    console.log(`[yields] Best APY — cUSD: ${bestCUSD.toFixed(2)}%  cEUR: ${bestCEUR.toFixed(2)}%`);

    return rates;
  } catch (err) {
    console.warn("[yields] Fetch failed:", (err as Error).message);
    return { cUSD: [], cEUR: [], updatedAt: Date.now() };
  }
}
