import { NextResponse } from "next/server";
import Redis from "ioredis";
import { FILECOIN_GATEWAY } from "@flowvault/shared";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

async function fetchFromFilecoin(cid: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${FILECOIN_GATEWAY}/ipfs/${cid}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function GET() {
  const cids = await redis.lrange("flowvault:rebalance_cids", 0, 9);

  if (cids.length === 0) {
    // Serve demo trades seeded by /api/seed-demo
    const demoRaw = await redis.get("flowvault:demo_trades");
    if (demoRaw) {
      return NextResponse.json({ trades: JSON.parse(demoRaw) });
    }
    return NextResponse.json({ trades: [] });
  }

  const trades = await Promise.all(
    cids.map(async (cid, i) => {
      const entry = await fetchFromFilecoin(cid);
      if (entry?.data && typeof entry.data === "object") {
        const d = entry.data as Record<string, unknown>;
        return {
          id: `trade-${i}`,
          timestamp: (entry.timestamp as number) ?? Date.now() - i * 3600_000,
          fromToken: d.fromToken ?? "USDC",
          toToken: d.toToken ?? "FLOW",
          fromAmount: d.fromAmount?.toString() ?? "0",
          toAmount: d.toAmount?.toString() ?? "0",
          txHash: (entry.txHash as string) ?? "0x" + "0".repeat(64),
          feesUSD: (d.feesUSD as number) ?? 0,
          filecoinCid: cid,
        };
      }
      // Fallback with CID preserved if Filecoin fetch fails
      return {
        id: `trade-${i}`,
        timestamp: Date.now() - i * 3600_000,
        fromToken: "USDC",
        toToken: "FLOW",
        fromAmount: "0",
        toAmount: "0",
        txHash: "0x" + "0".repeat(64),
        feesUSD: 0,
        filecoinCid: cid,
      };
    })
  );

  return NextResponse.json({ trades });
}
