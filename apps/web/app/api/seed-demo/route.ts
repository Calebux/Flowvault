/**
 * POST /api/seed-demo
 * Seeds Redis with a realistic demo treasury state so the dashboard
 * looks live on first load without needing the agent-core process or
 * real on-chain balances.
 *
 * Safe to call repeatedly — existing expense data is preserved.
 */
import { NextResponse } from "next/server";
import redis from "@/lib/redis";

export async function POST() {
  try {
    const now = Date.now();

    // ── Token prices ─────────────────────────────────────────────────────────
    const prices = { FLOW: 0.74, USDC: 1.0, USDT: 1.0, stFLOW: 0.777, updatedAt: now };
    await redis.set("flowvault:token_prices", JSON.stringify(prices));

    // ── Market signals ────────────────────────────────────────────────────────
    await redis.set("flowvault:market_signals", JSON.stringify({ flow24hChange: 15.3 }));

    // ── Last tick — FLOW overweight, forces interesting AI decision ───────────
    const totalUSD = 841760;
    const current = { FLOW: 36.4, USDC: 39.3, USDT: 14.3, stFLOW: 10.0 };
    const drift = { FLOW: 11.4, USDC: -10.7, USDT: -0.7, stFLOW: 0.0 };
    const tick = {
      rates: prices,
      balances: [
        { token: "FLOW",   address: "0xd3bF53DAC106A0290B0483EcBC89d40FcC961f3e", balance: "0", balanceUSD: Math.round((current.FLOW   / 100) * totalUSD) },
        { token: "USDC",   address: "0xF1815bd50389c46847f0Bda824eC8da914045D14", balance: "0", balanceUSD: Math.round((current.USDC   / 100) * totalUSD) },
        { token: "USDT",   address: "0x674843C06FF83502ddb4D37c2E09C01cdA38cbc8", balance: "0", balanceUSD: Math.round((current.USDT   / 100) * totalUSD) },
        { token: "stFLOW", address: "0x53bDb5D23e5e70B1c0B739b38bCB83b8B8d71e5c", balance: "0", balanceUSD: Math.round((current.stFLOW / 100) * totalUSD) },
      ],
      currentAllocation: current,
      drift,
      shouldRebalance: true,
      tickAt: now - 8_000,
    };
    await redis.set("flowvault:last_tick", JSON.stringify(tick));

    // ── Agent state — active, 4 hours uptime, 3 past trades ──────────────────
    const startedAt = now - 4 * 3600_000;
    await redis.set("flowvault:agent_state", JSON.stringify({
      status: "active",
      startedAt,
      lastTickAt: now - 8_000,
      totalTrades: 3,
      totalFeesUSD: 0.47,
      uptime: 4 * 3600,
    }));

    // ── Reasoning log — 5 realistic Hermes entries ────────────────────────────
    const reasoningEntries = [
      {
        text: "FLOW has appreciated +15.3% in the last 24h, pushing allocation to 36.4% — well above the 25% target. Drift of +11.4% exceeds the 5% threshold. Checking expense schedule before acting: Q2 payroll of $45,000 USDC due in 32 days — stable reserve ($330,966) remains adequate after this swap. Executing FLOW→USDC rebalance.",
        action: "execute_swap",
        timestamp: now - 2 * 3600_000,
        filecoinCid: "bafybeigdyrzt5sfp7kdmsguj5ah43j4ol4i29szx4c5df0bcwjnle7bfxnh",
      },
      {
        text: "Portfolio balanced after rebalance. Idle USDC balance of $52,000 detected — not currently earning yield. Deploying 80% ($41,600) to IncrementFi USDC lending vault at 4.87% APY. Keeping 20% liquid for gas and future swaps. Telegram notification sent to treasury committee.",
        action: "deposit_to_yield",
        timestamp: now - 110 * 60_000,
        filecoinCid: "bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf4wcq",
      },
      {
        text: "Routine scan — all token drift below 5% threshold. FLOW: +0.3%, USDC: -0.2%, USDT: -0.1%, stFLOW: +0.1%. Market: FLOW up +14.8% (strong uptrend). Expense reserves intact. No rebalance required. Yield positions earning 4.87% APY on $52k USDC. Holding.",
        action: "hold",
        timestamp: now - 95 * 60_000,
        filecoinCid: null,
      },
      {
        text: "Second daily rebalance: USDC→stFLOW $249.87 to restore stFLOW toward 10% target. IncrementFi router confirmed. All 6 delegation rules satisfied — swap below $500 cap, within 06:00–22:00 UTC window, daily volume $923.49 of $2,000 limit used.",
        action: "execute_swap",
        timestamp: now - 7 * 3600_000,
        filecoinCid: "bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq",
      },
      {
        text: "Initial treasury scan complete. $841,760 across 4 tokens. FLOW drifted +10.8% above target due to overnight price appreciation. Upcoming expenses loaded: Q2 Payroll $45k (32d), Audit Retainer $25k (58d), Grants $15k (75d). Agent monitoring initialized — will rebalance when drift exceeds 5%.",
        action: "hold",
        timestamp: now - 4 * 3600_000,
        filecoinCid: null,
      },
    ];

    // Only seed reasoning_log if empty (don't overwrite real tick data)
    const existingLog = await redis.llen("flowvault:reasoning_log");
    if (existingLog === 0) {
      for (const entry of reasoningEntries) {
        await redis.lpush("flowvault:reasoning_log", JSON.stringify(entry));
      }
      await redis.ltrim("flowvault:reasoning_log", 0, 49);
      await redis.set("flowvault:last_reasoning", JSON.stringify(reasoningEntries[0]), "EX", 86400);
    }

    // ── Yield rates — realistic DeFiLlama-style data for Flow ─────────────────
    const yieldRates = {
      USDC: [
        { protocol: "IncrementFi",  symbol: "USDC",  apy: 4.87, tvlUsd: 2_340_000 },
        { protocol: "Sturdy Finance", symbol: "USDC", apy: 3.94, tvlUsd: 890_000 },
        { protocol: "Celer cBridge", symbol: "USDC",  apy: 2.21, tvlUsd: 450_000 },
      ],
      USDT: [
        { protocol: "IncrementFi",  symbol: "USDT",  apy: 4.52, tvlUsd: 1_120_000 },
        { protocol: "Sturdy Finance", symbol: "USDT", apy: 3.71, tvlUsd: 540_000 },
      ],
      updatedAt: now,
    };
    await redis.set("flowvault:yield_rates", JSON.stringify(yieldRates));

    // ── Demo expenses — only seed if not already customised ───────────────────
    const existingExpenses = await redis.get("flowvault:dao_expenses");
    if (!existingExpenses) {
      const expenses = [
        { id: "exp-1", description: "Q2 Contributor Payroll",      amountUSD: 45000, token: "USDC", dueDate: now + 32 * 86400_000, reserved: true  },
        { id: "exp-2", description: "Audit Retainer — Trail of Bits", amountUSD: 25000, token: "USDC", dueDate: now + 58 * 86400_000, reserved: true  },
        { id: "exp-3", description: "Community Grants — Round 3",   amountUSD: 15000, token: "USDT", dueDate: now + 75 * 86400_000, reserved: false },
        { id: "exp-4", description: "Protocol Insurance Premium",   amountUSD:  8000, token: "USDC", dueDate: now + 90 * 86400_000, reserved: false },
      ];
      await redis.set("flowvault:dao_expenses", JSON.stringify(expenses));
    }

    // ── Demo trade CIDs — realistic past trades ───────────────────────────────
    // Only seed if no real trades exist
    const existingCids = await redis.llen("flowvault:rebalance_cids");
    if (existingCids === 0) {
      // Store as JSON blobs under demo keys so history route can find them
      const demoTrades = [
        {
          id: "demo-trade-3",
          timestamp: now - 2 * 3600_000,
          fromToken: "FLOW", toToken: "USDC",
          fromAmount: "675.68", toAmount: "673.62",
          txHash: "0x4a8f2e7b9c1d3e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d80",
          feesUSD: 0.21,
          filecoinCid: "bafybeigdyrzt5sfp7kdmsguj5ah43j4ol4i29szx4c5df0bcwjnle7bfxnh",
          reasoning: "FLOW drifted +11.4% above target due to 24h price appreciation — selling FLOW to restore USDC ratio before Q2 payroll reserve.",
        },
        {
          id: "demo-trade-2",
          timestamp: now - 8 * 3600_000,
          fromToken: "USDC", toToken: "stFLOW",
          fromAmount: "249.87", toAmount: "251.14",
          txHash: "0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
          feesUSD: 0.09,
          filecoinCid: "bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf4wcq",
          reasoning: "stFLOW drifted -2.8% below target — buying stFLOW to restore liquid staking allocation and earn staking yield.",
        },
        {
          id: "demo-trade-1",
          timestamp: now - 47 * 3600_000,
          fromToken: "FLOW", toToken: "USDC",
          fromAmount: "491.24", toAmount: "489.76",
          txHash: "0x9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f",
          feesUSD: 0.17,
          filecoinCid: "bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq",
          reasoning: "FLOW overweight by +9.8% after weekend rally — rebalancing to USDC ahead of scheduled grant disbursements.",
        },
      ];
      await redis.set("flowvault:demo_trades", JSON.stringify(demoTrades));
    }

    return NextResponse.json({ success: true, seeded: true, totalUSD });
  } catch (err) {
    console.error("[api/seed-demo]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
