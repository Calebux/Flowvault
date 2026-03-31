import { NextResponse } from "next/server";
import { createPublicClient, http, parseAbi, formatUnits } from "viem";
import { defineChain } from "viem";
import Redis from "ioredis";
import {
  DEFAULT_TARGET_ALLOCATION,
  FLOW_TOKENS,
} from "@flowvault/shared";
import type { FlowToken } from "@flowvault/shared";

const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
]);

const flowMainnet = defineChain({
  id: 747,
  name: "Flow EVM",
  nativeCurrency: { name: "Flow", symbol: "FLOW", decimals: 18 },
  rpcUrls: { default: { http: [process.env.FLOW_EVM_RPC_URL ?? "https://mainnet.evm.nodes.onflow.org"] } },
});

const client = createPublicClient({
  chain: flowMainnet,
  transport: http(process.env.FLOW_EVM_RPC_URL ?? "https://mainnet.evm.nodes.onflow.org"),
});

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

export async function GET() {
  const smartAccount = process.env.FLOW_SMART_ACCOUNT_ADDRESS as `0x${string}` | undefined;

  // Load token prices from Redis cache (written by agent-core every 60s via Pyth)
  let rates = { FLOW: 0.5, USDC: 1.0, USDT: 1.0, stFLOW: 0.525 };
  try {
    const cached = await redis.get("flowvault:token_prices");
    if (cached) rates = { ...rates, ...JSON.parse(cached) };
  } catch {
    // Use defaults
  }

  // Load user config for target allocation
  let targetAllocation = DEFAULT_TARGET_ALLOCATION;
  try {
    const cfg = await redis.get("flowvault:user_config");
    if (cfg) targetAllocation = JSON.parse(cfg).targetAllocation ?? DEFAULT_TARGET_ALLOCATION;
  } catch {
    // Use defaults
  }

  if (!smartAccount) {
    // Return zeroed balances if no account configured
    const empty = Object.keys(FLOW_TOKENS).map((token) => ({
      token,
      address: FLOW_TOKENS[token],
      balance: "0",
      balanceUSD: 0,
    }));
    return NextResponse.json({ balances: empty, targetAllocation, totalUSD: 0 });
  }

  try {
    const tokens = Object.entries(FLOW_TOKENS) as [FlowToken, `0x${string}`][];
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
