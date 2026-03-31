import type { TickResult, UserConfig } from "@flowvault/shared";
import Redis from "ioredis";
import type { YieldRates } from "./yields";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

const BASE_URL = process.env.HERMES_BASE_URL ?? "https://inference-api.nousresearch.com/v1";
const API_KEY  = process.env.HERMES_API_KEY ?? "";
const MODEL    = process.env.HERMES_MODEL || "hermes-4-70b";

const FLOW_TOKENS_ENUM = ["FLOW", "USDC", "USDT", "stFLOW"] as const;

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    type: "function",
    function: {
      name: "execute_swap",
      description: "Execute a token swap to rebalance the DAO treasury. Use when drift exceeds threshold and rebalancing improves alignment with the target allocation.",
      parameters: {
        type: "object",
        properties: {
          fromToken: { type: "string", enum: FLOW_TOKENS_ENUM, description: "Token to sell" },
          toToken:   { type: "string", enum: FLOW_TOKENS_ENUM, description: "Token to buy" },
          amountUSD: { type: "number", description: "USD value to swap" },
          reason:    { type: "string", description: "Plain-English explanation stored on-chain as a Flow event" },
        },
        required: ["fromToken", "toToken", "amountUSD", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_alert",
      description: "Send a Telegram alert to the DAO admin without executing a swap. Use for drift warnings, market observations, or status updates.",
      parameters: {
        type: "object",
        properties: {
          message:  { type: "string", description: "The alert message to send" },
          severity: { type: "string", enum: ["info", "warning", "critical"] },
        },
        required: ["message", "severity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deposit_to_yield",
      description: "Deposit idle stablecoins (USDC or USDT) into a Flow yield protocol (IncrementFi lending) to earn yield. Use when portfolio is balanced and stablecoins are sitting idle.",
      parameters: {
        type: "object",
        properties: {
          token:     { type: "string", enum: ["USDC", "USDT"], description: "Stablecoin to deposit" },
          amountUSD: { type: "number", description: "USD value to deposit" },
          reason:    { type: "string", description: "Why depositing — e.g. earning yield on idle USDC" },
        },
        required: ["token", "amountUSD", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "withdraw_from_yield",
      description: "Withdraw stablecoins from a Flow yield protocol back to the treasury wallet. Use before a rebalance swap if wallet balance is insufficient.",
      parameters: {
        type: "object",
        properties: {
          token:     { type: "string", enum: ["USDC", "USDT"], description: "Stablecoin to withdraw" },
          amountUSD: { type: "number", description: "USD value to withdraw" },
          reason:    { type: "string", description: "Why withdrawing" },
        },
        required: ["token", "amountUSD", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reserve_expense",
      description: "Ring-fence stablecoins for an upcoming DAO expense BEFORE rebalancing. Call this when a rebalance would reduce the stable reserve below a required payment amount. This emits a Flow event with the reason — creating a permanent on-chain audit trail.",
      parameters: {
        type: "object",
        properties: {
          token:          { type: "string", enum: ["USDC", "USDT"], description: "Stablecoin to ring-fence" },
          amountUSD:      { type: "number", description: "USD value to reserve" },
          reason:         { type: "string", description: "Plain-English reason — stored on-chain as a Flow event" },
          daysUntilNeeded: { type: "number", description: "Days until the payment is due" },
        },
        required: ["token", "amountUSD", "reason", "daysUntilNeeded"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "hold",
      description: "Take no action this tick. Use when the portfolio is within acceptable bounds or conditions do not warrant action.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Why no action is needed" },
        },
        required: ["reason"],
      },
    },
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SwapDecision {
  action: "execute_swap";
  fromToken: string;
  toToken: string;
  amountUSD: number;
  reason: string;
}

export interface AlertDecision {
  action: "send_alert";
  message: string;
  severity: "info" | "warning" | "critical";
}

export interface HoldDecision {
  action: "hold";
  reason: string;
}

export interface YieldDecision {
  action: "deposit_to_yield" | "withdraw_from_yield";
  token: string;
  amountUSD: number;
  reason: string;
}

export interface ReserveExpenseDecision {
  action: "reserve_expense";
  token: string;
  amountUSD: number;
  reason: string;
  daysUntilNeeded: number;
}

export type AgentDecision = SwapDecision | AlertDecision | HoldDecision | YieldDecision | ReserveExpenseDecision;

// ─── Decision loop ────────────────────────────────────────────────────────────

export async function decideAction(
  result: TickResult,
  config: UserConfig,
  yieldPositions?: Record<string, number>
): Promise<AgentDecision[]> {
  const totalUSD = result.balances.reduce((s, b) => s + b.balanceUSD, 0);

  // Load yield rates from Redis (fetched by monitor each tick)
  let yieldContext = "";
  try {
    const yieldsRaw = await redis.get("flowvault:yield_rates");
    if (yieldsRaw) {
      const yields = JSON.parse(yieldsRaw) as YieldRates;
      const fmt = (ops: YieldRates["USDC"]) =>
        ops.length ? ops.map(o => `${o.protocol} ${o.apy.toFixed(2)}% APY`).join(", ") : "none found";
      yieldContext = `\nFlow yield opportunities:\n  USDC: ${fmt(yields.USDC)}\n  USDT: ${fmt(yields.USDT)}`;
    }
  } catch { /* ignore */ }

  const yieldCtx = yieldPositions && Object.values(yieldPositions).some(v => v > 0)
    ? `\nYield positions (earning yield):\n${Object.entries(yieldPositions).map(([t, v]) => `  ${t}: $${v.toFixed(2)}`).join("\n")}`
    : "\nYield positions: none (stablecoins not earning yield)";

  // Load market signals from Redis
  let marketContext = "";
  try {
    const raw = await redis.get("flowvault:market_signals");
    if (raw) {
      const signals = JSON.parse(raw) as { flow24hChange: number };
      const dir = signals.flow24hChange > 0 ? "▲" : "▼";
      const abs = Math.abs(signals.flow24hChange).toFixed(2);
      const sentiment = Math.abs(signals.flow24hChange) > 5
        ? signals.flow24hChange > 0 ? "strong uptrend" : "strong downtrend"
        : Math.abs(signals.flow24hChange) > 2
          ? signals.flow24hChange > 0 ? "mild uptrend" : "mild downtrend"
          : "stable";
      marketContext = `\nMarket signals (24h):\n  FLOW: ${dir}${abs}% (${sentiment})`;
    }
  } catch { /* ignore */ }

  // Build DAO expense context if available
  let expenseContext = "";
  if (config.daoConfig?.expenseSchedule?.length) {
    const now = Date.now();
    const upcoming = config.daoConfig.expenseSchedule
      .filter(e => e.dueDate > now)
      .sort((a, b) => a.dueDate - b.dueDate)
      .slice(0, 3);
    if (upcoming.length) {
      const lines = upcoming.map(e => {
        const days = Math.ceil((e.dueDate - now) / 86400_000);
        return `  - ${e.description}: $${e.amountUSD.toFixed(0)} ${e.token} in ${days}d`;
      });
      expenseContext = `\nDAO upcoming expenses:\n${lines.join("\n")}`;
    }
  }

  const context = `
Portfolio value: $${totalUSD.toFixed(2)}
Current allocation:
  FLOW:   ${result.currentAllocation.FLOW.toFixed(2)}% (target: ${config.targetAllocation.FLOW}%)
  USDC:   ${result.currentAllocation.USDC.toFixed(2)}% (target: ${config.targetAllocation.USDC}%)
  USDT:   ${result.currentAllocation.USDT.toFixed(2)}% (target: ${config.targetAllocation.USDT}%)
  stFLOW: ${result.currentAllocation.stFLOW.toFixed(2)}% (target: ${config.targetAllocation.stFLOW}%)

Drift from target:
  FLOW:   ${result.drift.FLOW > 0 ? "+" : ""}${result.drift.FLOW.toFixed(2)}%
  USDC:   ${result.drift.USDC > 0 ? "+" : ""}${result.drift.USDC.toFixed(2)}%
  USDT:   ${result.drift.USDT > 0 ? "+" : ""}${result.drift.USDT.toFixed(2)}%
  stFLOW: ${result.drift.stFLOW > 0 ? "+" : ""}${result.drift.stFLOW.toFixed(2)}%

Token prices (USD):
  FLOW:   $${result.rates.FLOW.toFixed(4)}
  USDC:   $${result.rates.USDC.toFixed(4)}
  USDT:   $${result.rates.USDT.toFixed(4)}
  stFLOW: $${result.rates.stFLOW.toFixed(4)}

DAO rules:
  Drift threshold: ${config.driftThreshold}%
  Max single swap: $${config.rules.maxSwapAmountUSD}
  Max daily volume: $${config.rules.maxDailyVolumeUSD}
${marketContext}
${yieldContext}
${yieldCtx}
${expenseContext}
`.trim();

  const systemPrompt = `You are FlowVault, an autonomous treasury management agent for Flow DAOs.
Your job is to analyze the DAO treasury, weigh market conditions and upcoming expenses, then call the right tool.

Decision rules:
1. EXPENSE CHECK FIRST: If any upcoming expense (within 90 days) requires stablecoins and a rebalance would reduce stable reserves below the required amount — call reserve_expense BEFORE any swap.
2. If ANY token drift EXCEEDS the threshold AND portfolio value > $0: call execute_swap. Sell the most overweight token, buy the most underweight. Amount = min(overweight USD value, max single swap).
   - Exception: if FLOW is in a strong downtrend (>5% down 24h) and you would be buying FLOW, consider whether the rebalance benefit outweighs the momentum risk. If drift is only slightly above threshold (< 2x threshold), you MAY hold and send_alert instead.
3. If drift is between 80%-100% of threshold: call send_alert only.
4. If all drift is below 80% of threshold AND idle USDC/USDT are not earning yield: call deposit_to_yield to put idle stablecoins to work.
5. If all drift is below 80% of threshold AND stablecoins are already in yield: call hold.

Market timing guidance:
- Strong uptrend (>5% 24h): rebalancing into FLOW is favorable — act on smaller drift.
- Strong downtrend (>5% 24h): rebalancing into FLOW carries momentum risk — require drift to clearly exceed threshold.
- Stable market: follow standard drift rules strictly.

IMPORTANT: Every reason string you provide is stored as a permanent Flow event on-chain. Be specific and auditable. Bad: "rebalancing". Good: "FLOW drifted +8.2% above target due to 24h price appreciation — selling FLOW to restore USDC ratio before Q2 payroll reserve."

Before calling a tool, briefly state your reasoning in 1-2 sentences — what you observe, what market signals suggest, and why you chose this action over alternatives.`;

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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Hermes API error: ${res.status} ${err}`);
  }

  const data = await res.json() as {
    choices: {
      message: {
        content?: string;
        tool_calls?: { function: { name: string; arguments: string } }[];
      };
    }[];
  };

  // Capture and persist Hermes's reasoning text into a rolling log
  const reasoning = data.choices[0]?.message?.content;
  const toolCalls = data.choices[0]?.message?.tool_calls;

  // Determine primary action for the log entry
  const primaryAction = toolCalls?.[0]?.function?.name ?? "hold";

  if (reasoning?.trim()) {
    const entry = JSON.stringify({
      text: reasoning.trim(),
      action: primaryAction,
      timestamp: Date.now(),
    });
    // Keep a rolling log of the last 50 reasoning entries
    await redis.lpush("flowvault:reasoning_log", entry);
    await redis.ltrim("flowvault:reasoning_log", 0, 49);
    // Also keep the legacy single key for backward compat
    await redis.set("flowvault:last_reasoning", entry, "EX", 3600);
    console.log(`[llm] Hermes: [${primaryAction}] ${reasoning.trim().slice(0, 120)}...`);
  }

  if (!toolCalls?.length) {
    return [{ action: "hold", reason: "No tool calls returned by Hermes" }];
  }

  const decisions: AgentDecision[] = [];
  for (const call of toolCalls) {
    const args = JSON.parse(call.function.arguments);

    switch (call.function.name) {
      case "execute_swap":
        decisions.push({ action: "execute_swap", ...args });
        break;
      case "send_alert":
        decisions.push({ action: "send_alert", ...args });
        break;
      case "deposit_to_yield":
      case "withdraw_from_yield":
        decisions.push({ action: call.function.name, token: args.token, amountUSD: args.amountUSD, reason: args.reason });
        break;
      case "reserve_expense":
        decisions.push({ action: "reserve_expense", token: args.token, amountUSD: args.amountUSD, reason: args.reason, daysUntilNeeded: args.daysUntilNeeded });
        break;
      default:
        decisions.push({ action: "hold", reason: args.reason ?? "Holding" });
    }
  }

  return decisions;
}

// ─── /ask handler ─────────────────────────────────────────────────────────────

export async function answerPortfolioQuestion(
  question: string,
  context: { result: TickResult; totalUSD: number }
): Promise<string> {
  const { result, totalUSD } = context;

  const contextBlock = `DAO treasury value: $${totalUSD.toFixed(2)}
Allocation: FLOW ${result.currentAllocation.FLOW.toFixed(1)}%, USDC ${result.currentAllocation.USDC.toFixed(1)}%, USDT ${result.currentAllocation.USDT.toFixed(1)}%, stFLOW ${result.currentAllocation.stFLOW.toFixed(1)}%
Drift: ${Object.entries(result.drift).map(([t, d]) => `${t}: ${(d as number) > 0 ? "+" : ""}${(d as number).toFixed(1)}%`).join(", ")}
Prices: FLOW=$${result.rates.FLOW.toFixed(4)}, USDC=$${result.rates.USDC.toFixed(4)}, stFLOW=$${result.rates.stFLOW.toFixed(4)}
Rebalance needed: ${result.shouldRebalance ? "YES" : "NO"}`;

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: "You are FlowVault, an autonomous DAO treasury manager on Flow. Be concise and precise. No markdown." },
        { role: "user", content: `${contextBlock}\n\nUser question: ${question}` },
      ],
      temperature: 0.4,
      max_tokens: 512,
    }),
  });

  if (!res.ok) throw new Error(`Hermes error: ${res.status}`);
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? "No response.";
}
