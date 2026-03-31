import { createPublicClient, http, parseAbi, formatUnits } from "viem";
import { celo } from "viem/chains";
import Redis from "ioredis";
import {
  MENTO_TOKENS,
  DEFAULT_TARGET_ALLOCATION,
  computeDrift,
  exceedsThreshold,
} from "@mentoguard/shared";
import type {
  UserConfig,
  TickResult,
  FXRates,
  TokenBalance,
  TargetAllocation,
  MentoToken,
} from "@mentoguard/shared";
import { logTick } from "./memory";
import { fetchYieldRates } from "./yields";

const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

const client = createPublicClient({
  chain: celo,
  transport: http(process.env.CELO_RPC_URL ?? "https://forno.celo.org"),
});

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

// Frankfurter is a free, no-key-required forex API backed by the ECB
// cUSD=USD, cEUR≈EUR/USD, cBRL≈BRL/USD, cREAL≈BRL/USD (same peg)
export async function fetchFXRates(): Promise<FXRates> {
  const [fxRes, celoRes] = await Promise.all([
    fetch("https://api.frankfurter.app/latest?base=USD&symbols=EUR,BRL"),
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=celo&vs_currencies=usd&include_24hr_change=true"),
  ]);

  if (!fxRes.ok) throw new Error(`Frankfurter API error: ${fxRes.status}`);
  const data = (await fxRes.json()) as { rates: { EUR: number; BRL: number } };
  const eurUSD  = 1 / data.rates.EUR;
  const brlUSD  = 1 / data.rates.BRL;

  let celoUSD = 0.5; // fallback if CoinGecko is unavailable
  let celo24hChange = 0;
  if (celoRes.ok) {
    const celoData = (await celoRes.json()) as { celo?: { usd?: number; usd_24h_change?: number } };
    celoUSD = celoData.celo?.usd ?? celoUSD;
    celo24hChange = celoData.celo?.usd_24h_change ?? 0;
  }

  // Store market signals in Redis for LLM context
  await redis.set(
    "mentoguard:market_signals",
    JSON.stringify({ celo24hChange, updatedAt: Date.now() }),
    "EX", 120
  );

  const rates: FXRates = {
    cUSD:  1.0,
    cEUR:  eurUSD,
    cBRL:  brlUSD,
    cREAL: brlUSD,
    CELO:  celoUSD,
    updatedAt: Date.now(),
  };

  await redis.set("mentoguard:fx_rates", JSON.stringify(rates), "EX", 120);
  console.log(
    `[monitor] FX rates — cEUR: $${rates.cEUR.toFixed(4)}  cBRL: $${rates.cBRL.toFixed(4)}  CELO: $${rates.CELO.toFixed(4)}`
  );
  return rates;
}

export async function fetchPortfolioBalances(
  smartAccount: `0x${string}`
): Promise<TokenBalance[]> {
  const tokens = Object.entries(MENTO_TOKENS) as [MentoToken, `0x${string}`][];

  const results = await Promise.all(
    tokens.map(async ([token, address]) => {
      try {
        const balance = await client.readContract({
          address,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [smartAccount],
        });
        return { token, address, balance, balanceUSD: 0 };
      } catch {
        // Token contract may not exist on mainnet — skip with zero balance
        return { token, address, balance: 0n, balanceUSD: 0 };
      }
    })
  );

  return results;
}

export function computeAllocation(
  balances: TokenBalance[],
  rates: FXRates
): TargetAllocation {
  const usdValues = balances.map((b) => ({
    token: b.token,
    usd: Number(formatUnits(b.balance, 18)) * rates[b.token as keyof typeof rates],
  }));

  const totalUSD = usdValues.reduce((s, v) => s + (v.usd as number), 0);
  if (totalUSD === 0) return DEFAULT_TARGET_ALLOCATION;

  const pct = (token: string) =>
    ((usdValues.find((v) => v.token === token)?.usd ?? 0) as number / totalUSD) * 100;
  return {
    cUSD:  pct("cUSD"),
    cEUR:  pct("cEUR"),
    cBRL:  pct("cBRL"),
    cREAL: pct("cREAL"),
    CELO:  pct("CELO"),
  };
}

export async function monitorTick(config: UserConfig): Promise<TickResult> {
  const [rates, balances] = await Promise.all([
    fetchFXRates(),
    fetchPortfolioBalances(config.smartAccount),
    fetchYieldRates(), // fire-and-forget into Redis; used by LLM context
  ]);

  const currentAllocation = computeAllocation(balances, rates);
  const drift = computeDrift(currentAllocation, config.targetAllocation);
  const shouldRebalance = exceedsThreshold(drift, config.driftThreshold);

  const balancesWithUSD = balances.map((b) => ({
    ...b,
    balanceUSD: Number(formatUnits(b.balance, 18)) * ((rates[b.token as keyof FXRates] as number) ?? 0),
  }));

  const result: TickResult = {
    rates,
    balances: balancesWithUSD,
    currentAllocation,
    drift,
    shouldRebalance,
    tickAt: Date.now(),
  };

  // Fire-and-forget — non-blocking Filecoin log
  logTick(result).catch((err) =>
    console.warn("[monitor] Filecoin log failed:", err)
  );

  return result;
}
