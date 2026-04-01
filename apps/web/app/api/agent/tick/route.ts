import { NextResponse } from "next/server";
import redis from "@/lib/redis";

const BASE_URL = process.env.HERMES_BASE_URL ?? "https://inference-api.nousresearch.com/v1";
const API_KEY = process.env.HERMES_API_KEY ?? "";
const MODEL = process.env.HERMES_MODEL ?? "hermes-4-70b";

const DEFAULT_TARGET = { FLOW: 25, USDC: 50, USDT: 15, stFLOW: 10 };

const TOOLS = [
  {
    type: "function",
    function: {
      name: "execute_swap",
      description: "Execute a token swap to rebalance the DAO treasury.",
      parameters: {
        type: "object",
        properties: {
          fromToken: { type: "string", enum: ["FLOW", "USDC", "USDT", "stFLOW"] },
          toToken: { type: "string", enum: ["FLOW", "USDC", "USDT", "stFLOW"] },
          amountUSD: { type: "number" },
          reason: { type: "string" },
        },
        required: ["fromToken", "toToken", "amountUSD", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reserve_expense",
      description: "Ring-fence stablecoins for an upcoming DAO expense before rebalancing.",
      parameters: {
        type: "object",
        properties: {
          token: { type: "string", enum: ["USDC", "USDT"] },
          amountUSD: { type: "number" },
          reason: { type: "string" },
          daysUntilNeeded: { type: "number" },
        },
        required: ["token", "amountUSD", "reason", "daysUntilNeeded"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deposit_to_yield",
      description: "Deposit idle stablecoins into a Flow yield protocol to earn yield.",
      parameters: {
        type: "object",
        properties: {
          token: { type: "string", enum: ["USDC", "USDT"] },
          amountUSD: { type: "number" },
          reason: { type: "string" },
        },
        required: ["token", "amountUSD", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_alert",
      description: "Send a Telegram alert to the DAO admin.",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string" },
          severity: { type: "string", enum: ["info", "warning", "critical"] },
        },
        required: ["message", "severity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "hold",
      description: "Take no action this tick.",
      parameters: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
  },
];

// Demo portfolio context: FLOW overweight, interesting for AI to decide on
function getDemoContext(targetAllocation: typeof DEFAULT_TARGET, driftThreshold: number) {
  const prices = { FLOW: 0.74, USDC: 1.0, USDT: 1.0, stFLOW: 0.777 };
  const totalUSD = 842000;
  const current = { FLOW: 36.4, USDC: 39.3, USDT: 14.3, stFLOW: 10.0 };
  const drift = {
    FLOW: current.FLOW - targetAllocation.FLOW,
    USDC: current.USDC - targetAllocation.USDC,
    USDT: current.USDT - targetAllocation.USDT,
    stFLOW: current.stFLOW - targetAllocation.stFLOW,
  };
  const shouldRebalance = Math.max(...Object.values(drift).map(Math.abs)) > driftThreshold;
  return { prices, totalUSD, current, drift, shouldRebalance };
}

export async function POST() {
  try {
    // Load config from Redis
    let targetAllocation = DEFAULT_TARGET;
    let driftThreshold = 5;
    try {
      const configRaw = await redis.get("flowvault:user_config");
      if (configRaw) {
        const cfg = JSON.parse(configRaw);
        if (cfg.targetAllocation) targetAllocation = { ...DEFAULT_TARGET, ...cfg.targetAllocation };
        if (cfg.driftThreshold) driftThreshold = cfg.driftThreshold;
      }
    } catch { /* use defaults */ }

    // Load prices from Redis
    let prices = { FLOW: 0.74, USDC: 1.0, USDT: 1.0, stFLOW: 0.777 };
    try {
      const pricesRaw = await redis.get("flowvault:token_prices");
      if (pricesRaw) prices = { ...prices, ...JSON.parse(pricesRaw) };
    } catch { /* use defaults */ }

    // Build portfolio context from last tick or demo data
    let totalUSD = 0;
    let current = { FLOW: 0, USDC: 0, USDT: 0, stFLOW: 0 };
    let drift = { FLOW: 0, USDC: 0, USDT: 0, stFLOW: 0 };
    let shouldRebalance = false;

    const lastTickRaw = await redis.get("flowvault:last_tick");
    if (lastTickRaw) {
      try {
        const lastTick = JSON.parse(lastTickRaw);
        totalUSD = lastTick.balances?.reduce((s: number, b: { balanceUSD: number }) => s + b.balanceUSD, 0) ?? 0;
        if (totalUSD > 0 && lastTick.currentAllocation && lastTick.drift) {
          current = lastTick.currentAllocation;
          drift = lastTick.drift;
          shouldRebalance = lastTick.shouldRebalance ?? false;
        } else {
          // Last tick exists but has zero balances — use demo context
          const demo = getDemoContext(targetAllocation, driftThreshold);
          prices = demo.prices;
          totalUSD = demo.totalUSD;
          current = demo.current;
          drift = demo.drift;
          shouldRebalance = demo.shouldRebalance;
        }
      } catch {
        const demo = getDemoContext(targetAllocation, driftThreshold);
        prices = demo.prices;
        totalUSD = demo.totalUSD;
        current = demo.current;
        drift = demo.drift;
        shouldRebalance = demo.shouldRebalance;
      }
    } else {
      const demo = getDemoContext(targetAllocation, driftThreshold);
      prices = demo.prices;
      totalUSD = demo.totalUSD;
      current = demo.current;
      drift = demo.drift;
      shouldRebalance = demo.shouldRebalance;
    }

    // Build supplementary context from Redis
    let marketContext = "";
    try {
      const raw = await redis.get("flowvault:market_signals");
      if (raw) {
        const signals = JSON.parse(raw);
        const dir = signals.flow24hChange > 0 ? "▲" : "▼";
        const abs = Math.abs(signals.flow24hChange).toFixed(2);
        marketContext = `\nMarket signals (24h):\n  FLOW: ${dir}${abs}%`;
      }
    } catch { /* ignore */ }

    let yieldContext = "";
    try {
      const yieldsRaw = await redis.get("flowvault:yield_rates");
      if (yieldsRaw) {
        const yields = JSON.parse(yieldsRaw);
        const fmt = (ops: { protocol: string; apy: number }[]) =>
          ops?.length ? ops.map(o => `${o.protocol} ${o.apy.toFixed(2)}% APY`).join(", ") : "none found";
        yieldContext = `\nFlow yield opportunities:\n  USDC: ${fmt(yields.USDC || [])}\n  USDT: ${fmt(yields.USDT || [])}`;
      }
    } catch { /* ignore */ }

    let expenseContext = "";
    try {
      const expRaw = await redis.get("flowvault:dao_expenses");
      if (expRaw) {
        const expenses = JSON.parse(expRaw);
        const now = Date.now();
        const upcoming = expenses
          .filter((e: { dueDate: number }) => e.dueDate > now)
          .slice(0, 4)
          .map((e: { description: string; amountUSD: number; token: string; dueDate: number }) => {
            const days = Math.ceil((e.dueDate - now) / 86400_000);
            return `  - ${e.description}: $${e.amountUSD.toLocaleString()} ${e.token} in ${days}d`;
          });
        if (upcoming.length) expenseContext = `\nDAO upcoming expenses:\n${upcoming.join("\n")}`;
      }
    } catch { /* ignore */ }

    const context = `Portfolio value: $${totalUSD.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
Current allocation:
  FLOW:   ${current.FLOW.toFixed(2)}% (target: ${targetAllocation.FLOW}%)
  USDC:   ${current.USDC.toFixed(2)}% (target: ${targetAllocation.USDC}%)
  USDT:   ${current.USDT.toFixed(2)}% (target: ${targetAllocation.USDT}%)
  stFLOW: ${current.stFLOW.toFixed(2)}% (target: ${targetAllocation.stFLOW}%)

Drift from target:
  FLOW:   ${drift.FLOW > 0 ? "+" : ""}${drift.FLOW.toFixed(2)}%
  USDC:   ${drift.USDC > 0 ? "+" : ""}${drift.USDC.toFixed(2)}%
  USDT:   ${drift.USDT > 0 ? "+" : ""}${drift.USDT.toFixed(2)}%
  stFLOW: ${drift.stFLOW > 0 ? "+" : ""}${drift.stFLOW.toFixed(2)}%

Token prices (USD):
  FLOW:   $${prices.FLOW.toFixed(4)}
  USDC:   $${prices.USDC.toFixed(4)}
  USDT:   $${prices.USDT.toFixed(4)}
  stFLOW: $${prices.stFLOW.toFixed(4)}

DAO rules:
  Drift threshold: ${driftThreshold}%
  Max single swap: $500
  Max daily volume: $2000
${marketContext}
${yieldContext}
${expenseContext}`.trim();

    const systemPrompt = `You are FlowVault, an autonomous treasury management agent for Flow DAOs.
Your job is to analyze the DAO treasury, weigh market conditions and upcoming expenses, then call the right tool.

Decision rules:
1. EXPENSE CHECK FIRST: If any upcoming expense (within 90 days) requires stablecoins and a rebalance would reduce stable reserves below the required amount — call reserve_expense BEFORE any swap.
2. If ANY token drift EXCEEDS the threshold AND portfolio value > $0: call execute_swap. Sell the most overweight token, buy the most underweight. Amount = min(overweight USD value, max single swap limit $500).
3. If drift is between 80%-100% of threshold: call send_alert only.
4. If all drift is below 80% of threshold AND idle USDC/USDT not earning yield: call deposit_to_yield.
5. If all drift is below 80% of threshold AND stablecoins already in yield: call hold.

IMPORTANT: Every reason string you provide is stored as a permanent Flow event on-chain. Be specific and auditable.
Example: "FLOW drifted +11.4% above target due to 24h price appreciation — selling FLOW to restore USDC ratio before Q2 payroll reserve ($45,000 due in 32 days)."

Before calling a tool, briefly state your reasoning in 1-2 sentences.`;

    let reasoning = "";
    let action = "hold";
    let toolArgs: Record<string, unknown> = { reason: "Portfolio within acceptable bounds" };

    if (API_KEY) {
      try {
        const res = await fetch(`${BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${API_KEY}`,
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: context },
            ],
            tools: TOOLS,
            tool_choice: "auto",
            temperature: 0.2,
            max_tokens: 1024,
          }),
        });

        if (res.ok) {
          const data = await res.json() as {
            choices: {
              message: {
                content?: string;
                tool_calls?: { function: { name: string; arguments: string } }[];
              };
            }[];
          };
          reasoning = data.choices[0]?.message?.content ?? "";
          const toolCalls = data.choices[0]?.message?.tool_calls;
          if (toolCalls?.length) {
            action = toolCalls[0].function.name;
            toolArgs = JSON.parse(toolCalls[0].function.arguments);
          }
        }
      } catch (err) {
        console.error("[tick] Hermes API error:", err);
        // Fall through to demo fallback
      }
    }

    // Fallback if no API key or Hermes call failed
    if (!reasoning) {
      if (shouldRebalance) {
        const maxDrift = Object.entries(drift).sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))[0];
        const overweightToken = maxDrift[0];
        const underweightToken = Object.entries(drift).sort(([, a], [, b]) => a - b)[0][0];
        const driftAbs = Math.abs(maxDrift[1] as number).toFixed(1);
        reasoning = `${overweightToken} has drifted +${driftAbs}% above its ${targetAllocation[overweightToken as keyof typeof targetAllocation]}% target allocation, exceeding the ${driftThreshold}% rebalance threshold. Given the upcoming DAO expense schedule, I will execute a controlled rebalance to restore the target allocation while protecting the stable reserve.`;
        action = "execute_swap";
        toolArgs = {
          fromToken: overweightToken,
          toToken: underweightToken,
          amountUSD: Math.min(500, (Math.abs(maxDrift[1] as number) / 100) * totalUSD * 0.5),
          reason: `${overweightToken} drifted +${driftAbs}% above target — rebalancing to restore ${underweightToken} allocation and protect DAO expense reserves`,
        };
      } else {
        const maxDriftAbs = Math.max(...Object.values(drift).map(Math.abs)).toFixed(1);
        reasoning = `All token allocations are within the ${driftThreshold}% threshold. Maximum drift is ${maxDriftAbs}% — monitoring market conditions. No action required this tick.`;
        action = "hold";
        toolArgs = { reason: `All drift within ${driftThreshold}% threshold — portfolio balanced` };
      }
    }

    // Save reasoning to rolling log
    const reasoningEntry = JSON.stringify({ text: reasoning, action, timestamp: Date.now() });
    await redis.lpush("flowvault:reasoning_log", reasoningEntry);
    await redis.ltrim("flowvault:reasoning_log", 0, 49);
    await redis.set("flowvault:last_reasoning", reasoningEntry, "EX", 3600);

    // Simulate portfolio evolution so each tick shows different context
    const next = { ...current };
    if (action === "execute_swap" && toolArgs.fromToken && toolArgs.toToken) {
      const from = toolArgs.fromToken as keyof typeof next;
      const to = toolArgs.toToken as keyof typeof next;
      const swapPct = Math.min(
        ((toolArgs.amountUSD as number) / totalUSD) * 100,
        Math.abs(drift[from as keyof typeof drift] ?? 0)
      );
      next[from] = Math.max(0, current[from] - swapPct * 0.85);
      next[to] = Math.min(100, current[to] + swapPct * 0.85);
    } else if (action === "hold" || action === "deposit_to_yield") {
      // Slow market drift: FLOW creeps up ~0.4% per tick (simulates appreciation)
      const rate = 0.4;
      next.FLOW = Math.min(42, current.FLOW + rate);
      next.USDC = Math.max(28, current.USDC - rate * 0.7);
      next.USDT = Math.max(8, current.USDT - rate * 0.2);
      next.stFLOW = Math.max(6, current.stFLOW - rate * 0.1);
    }
    // Normalize to 100%
    const allocTotal = Object.values(next).reduce((s, v) => s + v, 0);
    if (allocTotal > 0) {
      (Object.keys(next) as (keyof typeof next)[]).forEach(k => {
        next[k] = parseFloat(((next[k] / allocTotal) * 100).toFixed(2));
      });
    }
    const nextDrift = {
      FLOW:   parseFloat((next.FLOW   - targetAllocation.FLOW).toFixed(2)),
      USDC:   parseFloat((next.USDC   - targetAllocation.USDC).toFixed(2)),
      USDT:   parseFloat((next.USDT   - targetAllocation.USDT).toFixed(2)),
      stFLOW: parseFloat((next.stFLOW - targetAllocation.stFLOW).toFixed(2)),
    };
    const nextShouldRebalance = Math.max(...Object.values(nextDrift).map(Math.abs)) > driftThreshold;

    // Save tick result to Redis
    const tickResult = {
      rates: prices,
      balances: [
        { token: "FLOW",   address: "0xd3bF53DAC106A0290B0483EcBC89d40FcC961f3e", balanceUSD: (next.FLOW   / 100) * totalUSD },
        { token: "USDC",   address: "0xF1815bd50389c46847f0Bda824eC8da914045D14", balanceUSD: (next.USDC   / 100) * totalUSD },
        { token: "USDT",   address: "0x674843C06FF83502ddb4D37c2E09C01cdA38cbc8", balanceUSD: (next.USDT   / 100) * totalUSD },
        { token: "stFLOW", address: "0x53bDb5D23e5e70B1c0B739b38bCB83b8B8d71e5c", balanceUSD: (next.stFLOW / 100) * totalUSD },
      ],
      currentAllocation: next,
      drift: nextDrift,
      shouldRebalance: nextShouldRebalance,
      tickAt: Date.now(),
    };
    await redis.set("flowvault:last_tick", JSON.stringify(tickResult));
    await redis.set("flowvault:token_prices", JSON.stringify({ ...prices, updatedAt: Date.now() }));

    // Update agent state
    const stateRaw = await redis.get("flowvault:agent_state");
    const state = stateRaw ? JSON.parse(stateRaw) : { startedAt: Date.now(), totalTrades: 0, totalFeesUSD: 0 };
    await redis.set("flowvault:agent_state", JSON.stringify({
      ...state,
      status: "active",
      lastTickAt: Date.now(),
      uptime: state.startedAt ? Math.floor((Date.now() - state.startedAt) / 1000) : 0,
    }));

    return NextResponse.json({
      success: true,
      action,
      toolArgs,
      reasoning: reasoning.slice(0, 300),
      drift: nextDrift,
      shouldRebalance: nextShouldRebalance,
    });
  } catch (err) {
    console.error("[api/agent/tick]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
