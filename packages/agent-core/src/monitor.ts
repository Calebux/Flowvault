import { createPublicClient, http, parseAbi, formatUnits, defineChain } from "viem";
import {
  FLOW_TOKENS,
  PYTH_CONTRACT_FLOW,
  PYTH_PRICE_IDS,
  FLOW_EVM_CHAIN_ID,
  DEFAULT_TARGET_ALLOCATION,
  computeDrift,
  exceedsThreshold,
} from "@flowvault/shared";
import type {
  UserConfig,
  TickResult,
  FXRates,
  TokenBalance,
  TargetAllocation,
  FlowToken,
} from "@flowvault/shared";
import { logTick } from "./memory";
import { fetchYieldRates } from "./yields";

// ─── Flow EVM chain definition ────────────────────────────────────────────────

export const flowTestnet = defineChain({
  id: 545,
  name: "Flow EVM Testnet",
  nativeCurrency: { name: "Flow", symbol: "FLOW", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.FLOW_EVM_RPC_URL ?? "https://testnet.evm.nodes.onflow.org"],
    },
  },
  blockExplorers: {
    default: { name: "FlowScan", url: "https://evm-testnet.flowscan.io" },
  },
});

export const flowMainnet = flowTestnet; // alias used by delegation, increment, yield-vaults

// ─── Clients ─────────────────────────────────────────────────────────────────

const client = createPublicClient({
  chain: flowTestnet,
  transport: http(process.env.FLOW_EVM_RPC_URL ?? "https://testnet.evm.nodes.onflow.org"),
});

import redis from "./redis";

// ─── ABIs ─────────────────────────────────────────────────────────────────────

const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

// Pyth oracle — returns (price, conf, expo, publishTime)
// price (USD) = price * 10^expo
const PYTH_ABI = parseAbi([
  "function getPriceUnsafe(bytes32 id) view returns (int64 price, uint64 conf, int32 expo, uint256 publishTime)",
  "function getPriceNoOlderThan(bytes32 id, uint256 age) view returns (int64 price, uint64 conf, int32 expo, uint256 publishTime)",
]);

// ─── Price fetching via Pyth ──────────────────────────────────────────────────

/** Convert Pyth raw price to USD float */
function pythToUSD(price: bigint, expo: number): number {
  // price * 10^expo  (expo is typically negative, e.g. -8)
  return Number(price) * Math.pow(10, expo);
}

export async function fetchTokenPrices(): Promise<FXRates> {
  const MAX_PRICE_AGE = 120; // accept prices up to 2 minutes old

  try {
    const [flowResult, usdcResult, usdtResult, stFlowResult] = await Promise.allSettled([
      client.readContract({
        address: PYTH_CONTRACT_FLOW,
        abi: PYTH_ABI,
        functionName: "getPriceNoOlderThan",
        args: [PYTH_PRICE_IDS.FLOW, BigInt(MAX_PRICE_AGE)],
      }),
      client.readContract({
        address: PYTH_CONTRACT_FLOW,
        abi: PYTH_ABI,
        functionName: "getPriceNoOlderThan",
        args: [PYTH_PRICE_IDS.USDC, BigInt(MAX_PRICE_AGE)],
      }),
      client.readContract({
        address: PYTH_CONTRACT_FLOW,
        abi: PYTH_ABI,
        functionName: "getPriceNoOlderThan",
        args: [PYTH_PRICE_IDS.USDT, BigInt(MAX_PRICE_AGE)],
      }),
      client.readContract({
        address: PYTH_CONTRACT_FLOW,
        abi: PYTH_ABI,
        functionName: "getPriceNoOlderThan",
        args: [PYTH_PRICE_IDS.stFLOW, BigInt(MAX_PRICE_AGE)],
      }),
    ]);

    // Extract price and expo from tuple results
    const parseResult = (res: PromiseSettledResult<unknown>, fallback: number): number => {
      if (res.status !== "fulfilled") return fallback;
      const [price, , expo] = res.value as [bigint, bigint, number, bigint];
      const usd = pythToUSD(price, expo);
      return usd > 0 ? usd : fallback;
    };

    const flowUSD   = parseResult(flowResult, 0.5);
    const usdcUSD   = parseResult(usdcResult, 1.0);
    const usdtUSD   = parseResult(usdtResult, 1.0);
    const stFlowUSD = parseResult(stFlowResult, flowUSD * 1.05); // stFLOW ≈ FLOW + staking premium

    // Compute FLOW 24h change for market signals
    // If we have a cached previous price, use it; otherwise skip
    let flow24hChange = 0;
    try {
      const prevRaw = await redis.get("flowvault:token_prices");
      if (prevRaw) {
        const prev = JSON.parse(prevRaw) as FXRates;
        if (prev.FLOW > 0 && Date.now() - prev.updatedAt < 86400_000) {
          flow24hChange = ((flowUSD - prev.FLOW) / prev.FLOW) * 100;
        }
      }
    } catch { /* redis unavailable — skip */ }

    // Store market signals for LLM context
    await redis.set(
      "flowvault:market_signals",
      JSON.stringify({ flow24hChange, updatedAt: Date.now() }),
      "EX", 120
    );

    const rates: FXRates = {
      FLOW:   flowUSD,
      USDC:   usdcUSD,
      USDT:   usdtUSD,
      stFLOW: stFlowUSD,
      updatedAt: Date.now(),
    };

    await redis.set("flowvault:token_prices", JSON.stringify(rates), "EX", 120);
    console.log(
      `[monitor] Prices — FLOW: $${rates.FLOW.toFixed(4)}  USDC: $${rates.USDC.toFixed(4)}  stFLOW: $${rates.stFLOW.toFixed(4)}`
    );
    return rates;

  } catch (err) {
    console.warn("[monitor] Pyth price fetch failed, using fallback prices:", (err as Error).message);
    // Return last known prices from Redis, or hardcoded fallbacks
    try {
      const cached = await redis.get("flowvault:token_prices");
      if (cached) return JSON.parse(cached) as FXRates;
    } catch { /* ignore */ }
    return { FLOW: 0.5, USDC: 1.0, USDT: 1.0, stFLOW: 0.525, updatedAt: Date.now() };
  }
}

// Keep old name as alias for compatibility
export const fetchFXRates = fetchTokenPrices;

// ─── Portfolio balances ───────────────────────────────────────────────────────

export async function fetchPortfolioBalances(
  smartAccount: `0x${string}`
): Promise<TokenBalance[]> {
  const tokens = Object.entries(FLOW_TOKENS) as [FlowToken, `0x${string}`][];

  const results = await Promise.all(
    tokens.map(async ([token, address]) => {
      try {
        const [balance, decimals] = await Promise.all([
          client.readContract({
            address,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [smartAccount],
          }),
          client.readContract({
            address,
            abi: ERC20_ABI,
            functionName: "decimals",
          }).catch(() => 18 as number),
        ]);
        return { token, address, balance: balance as bigint, balanceUSD: 0, decimals: decimals as number };
      } catch {
        return { token, address, balance: 0n, balanceUSD: 0, decimals: 18 };
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
    usd: Number(formatUnits(b.balance, 18)) * (rates[b.token as keyof FXRates] as number ?? 0),
  }));

  const totalUSD = usdValues.reduce((s, v) => s + v.usd, 0);
  if (totalUSD === 0) return DEFAULT_TARGET_ALLOCATION;

  const pct = (token: string) =>
    ((usdValues.find((v) => v.token === token)?.usd ?? 0) / totalUSD) * 100;

  return {
    FLOW:   pct("FLOW"),
    USDC:   pct("USDC"),
    USDT:   pct("USDT"),
    stFLOW: pct("stFLOW"),
  };
}

export async function monitorTick(config: UserConfig): Promise<TickResult> {
  const [rates, balances] = await Promise.all([
    fetchTokenPrices(),
    fetchPortfolioBalances(config.smartAccount),
    fetchYieldRates(), // fire-and-forget into Redis; used by LLM context
  ]);

  const currentAllocation = computeAllocation(balances, rates);
  const drift = computeDrift(currentAllocation, config.targetAllocation);
  const shouldRebalance = exceedsThreshold(drift, config.driftThreshold);

  const balancesWithUSD = balances.map((b) => ({
    ...b,
    balanceUSD: Number(formatUnits(b.balance, 18)) * (rates[b.token as keyof FXRates] as number ?? 0),
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
