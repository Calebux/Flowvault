import { NextResponse } from "next/server";
import { createPublicClient, http, parseAbi, formatUnits } from "viem";
import { celo } from "viem/chains";
import Redis from "ioredis";
import {
  DEFAULT_TARGET_ALLOCATION,
  MENTO_TOKENS,
} from "@mentoguard/shared";
import type { MentoToken } from "@mentoguard/shared";

const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
]);

const client = createPublicClient({
  chain: celo,
  transport: http(process.env.CELO_RPC_URL ?? "https://forno.celo.org"),
});

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

export async function GET() {
  const smartAccount = process.env.CELO_SMART_ACCOUNT_ADDRESS as `0x${string}` | undefined;

  // Load FX rates from Redis cache (written by agent-core every 60s)
  let rates = { cUSD: 1.0, cEUR: 1.08, cBRL: 0.2, cREAL: 0.18 };
  try {
    const cached = await redis.get("mentoguard:fx_rates");
    if (cached) rates = { ...rates, ...JSON.parse(cached) };
  } catch {
    // Use defaults
  }

  // Load user config for target allocation
  let targetAllocation = DEFAULT_TARGET_ALLOCATION;
  try {
    const cfg = await redis.get("mentoguard:user_config");
    if (cfg) targetAllocation = JSON.parse(cfg).targetAllocation ?? DEFAULT_TARGET_ALLOCATION;
  } catch {
    // Use defaults
  }

  if (!smartAccount) {
    // Return zeroed balances if no account configured
    const empty = Object.keys(MENTO_TOKENS).map((token) => ({
      token,
      address: MENTO_TOKENS[token],
      balance: "0",
      balanceUSD: 0,
    }));
    return NextResponse.json({ balances: empty, targetAllocation, totalUSD: 0 });
  }

  try {
    const tokens = Object.entries(MENTO_TOKENS) as [MentoToken, `0x${string}`][];
    const balances = await Promise.all(
      tokens.map(async ([token, address]) => {
        try {
          const raw = await client.readContract({
            address,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [smartAccount],
          });
          const amount = Number(formatUnits(raw, 18));
          const rate = rates[token as keyof typeof rates] ?? 0;
          return {
            token,
            address,
            balance: raw.toString(),
            balanceUSD: +(amount * rate).toFixed(2),
          };
        } catch {
          return { token, address, balance: "0", balanceUSD: 0 };
        }
      })
    );

    const totalUSD = balances.reduce((s, b) => s + b.balanceUSD, 0);
    return NextResponse.json({ balances, targetAllocation, totalUSD: +totalUSD.toFixed(2) });
  } catch (err) {
    console.error("[api/portfolio]", err);
    return NextResponse.json({ error: "Failed to fetch portfolio" }, { status: 500 });
  }
}
