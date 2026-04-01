import { NextResponse } from "next/server";
import { DEFAULT_TARGET_ALLOCATION, FLOW_TOKENS } from "@flowvault/shared";
import redis from "@/lib/redis";

// ── Hardcoded demo fallback — shown when Redis is empty ───────────────────────
const DEMO_TOTAL = 841761;
const DEMO_BALANCES = [
  { token: "FLOW",   address: "0xd3bF53DAC106A0290B0483EcBC89d40FcC961f3e", balance: "0", balanceUSD: 306401 },
  { token: "USDC",   address: "0xF1815bd50389c46847f0Bda824eC8da914045D14", balance: "0", balanceUSD: 330812 },
  { token: "USDT",   address: "0x674843C06FF83502ddb4D37c2E09C01cdA38cbc8", balance: "0", balanceUSD: 120372 },
  { token: "stFLOW", address: "0x53bDb5D23e5e70B1c0B739b38bCB83b8B8d71e5c", balance: "0", balanceUSD: 84176 },
];

export async function GET() {
  const targetAllocation = DEFAULT_TARGET_ALLOCATION;

  // 1. Try Redis tick cache (written by every agent tick)
  try {
    const tickRaw = await redis.get("flowvault:last_tick");
    if (tickRaw) {
      const tick = JSON.parse(tickRaw);
      const total = tick.balances?.reduce((s: number, b: { balanceUSD: number }) => s + b.balanceUSD, 0) ?? 0;
      if (total > 0) {
        return NextResponse.json({
          balances: tick.balances.map((b: { token: string; address: string; balanceUSD: number }) => ({
            token: b.token, address: b.address, balance: "0", balanceUSD: b.balanceUSD,
          })),
          targetAllocation,
          totalUSD: +total.toFixed(2),
          source: "tick-cache",
        });
      }
    }
  } catch { /* fall through */ }

  // 2. Try on-chain read if wallet configured
  const smartAccount = process.env.FLOW_SMART_ACCOUNT_ADDRESS as `0x${string}` | undefined;
  if (smartAccount) {
    try {
      const { createPublicClient, http, parseAbi, formatUnits, defineChain } = await import("viem");
      const chain = defineChain({
        id: 545,
        name: "Flow EVM Testnet",
        nativeCurrency: { name: "Flow", symbol: "FLOW", decimals: 18 },
        rpcUrls: { default: { http: [process.env.FLOW_EVM_RPC_URL ?? "https://testnet.evm.nodes.onflow.org"] } },
      });
      const client = createPublicClient({ chain, transport: http(undefined, { timeout: 5000 }) });
      const ERC20_ABI = parseAbi(["function balanceOf(address owner) view returns (uint256)"]);
      const entries = await Promise.all(
        (Object.entries(FLOW_TOKENS) as [string, `0x${string}`][]).map(async ([token, address]) => {
          try {
            const raw = await client.readContract({ address, abi: ERC20_ABI, functionName: "balanceOf", args: [smartAccount] });
            return { token, address, balance: raw.toString(), balanceUSD: +(Number(formatUnits(raw, 18)) * 0.74).toFixed(2) };
          } catch {
            return { token, address, balance: "0", balanceUSD: 0 };
          }
        })
      );
      const total = entries.reduce((s, b) => s + b.balanceUSD, 0);
      if (total > 0) return NextResponse.json({ balances: entries, targetAllocation, totalUSD: +total.toFixed(2) });
    } catch { /* fall through */ }
  }

  // 3. Hardcoded demo data — always works, no Redis required
  return NextResponse.json({ balances: DEMO_BALANCES, targetAllocation, totalUSD: DEMO_TOTAL, source: "demo" });
}
