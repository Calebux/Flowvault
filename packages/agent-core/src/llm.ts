import type { TickResult, UserConfig } from "@mentoguard/shared";
import Redis from "ioredis";
import type { YieldRates } from "./yields";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

const BASE_URL = process.env.HERMES_BASE_URL ?? "https://inference-api.nousresearch.com/v1";
const API_KEY  = process.env.HERMES_API_KEY ?? "";
const MODEL    = process.env.HERMES_MODEL || "hermes-4-70b";

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    type: "function",
    function: {
      name: "execute_swap",
      description: "Execute a token swap to rebalance the portfolio. Use this when drift is significant and a rebalance will improve alignment with the target allocation.",
      parameters: {
        type: "object",
        properties: {
          fromToken: { type: "string", enum: ["cUSD", "cEUR", "cBRL", "cREAL", "CELO"], description: "Token to sell" },
          toToken:   { type: "string", enum: ["cUSD", "cEUR", "cBRL", "cREAL", "CELO"], description: "Token to buy" },
          amountUSD: { type: "number", description: "USD value to swap" },
          reason:    { type: "string", description: "Plain-English explanation of why this swap is needed" },
        },
        required: ["fromToken", "toToken", "amountUSD", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_alert",
      description: "Send a Telegram alert to the user without executing a swap. Use for drift warnings, market observations, or status updates.",
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
      name: "deposit_to_aave",
      description: "Deposit idle stablecoins into Aave V3 on Celo to earn yield. Use when portfolio is balanced and a token has more balance than needed.",
      parameters: {
        type: "object",
        properties: {
          token:     { type: "string", enum: ["cUSD", "cEUR", "CELO"], description: "Token to deposit" },
          amountUSD: { type: "number", description: "USD value to deposit" },
          reason:    { type: "string", description: "Why depositing — e.g. earning yield on idle cUSD" },
        },
        required: ["token", "amountUSD", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "withdraw_from_aave",
      description: "Withdraw stablecoins from Aave V3 back to wallet. Use before a swap if wallet balance is insufficient.",
      parameters: {
        type: "object",
        properties: {
          token:     { type: "string", enum: ["cUSD", "cEUR", "CELO"], description: "Token to withdraw" },
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
      name: "hold",
      description: "Take no action this tick. Use when the portfolio is within acceptable bounds or conditions don't warrant action.",
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

export interface AaveDecision {
  action: "deposit_to_aave" | "withdraw_from_aave";
  token: string;
  amountUSD: number;
  reason: string;
}

export type AgentDecision = SwapDecision | AlertDecision | HoldDecision | AaveDecision;

// ─── Decision loop ────────────────────────────────────────────────────────────

export async function decideAction(
  result: TickResult,
  config: UserConfig,
  aavePositions?: Record<string, number>
): Promise<AgentDecision[]> {
  const totalUSD = result.balances.reduce((s, b) => s + b.balanceUSD, 0);

  // Load yield rates from Redis (fetched by monitor each tick)
  let yieldContext = "";
  try {
    const yieldsRaw = await redis.get("mentoguard:yield_rates");
    if (yieldsRaw) {
      const yields = JSON.parse(yieldsRaw) as YieldRates;
      const fmt = (ops: YieldRates["cUSD"]) =>
        ops.length ? ops.map(o => `${o.protocol} ${o.apy.toFixed(2)}% APY`).join(", ") : "none found";
      yieldContext = `\nYield opportunities on Celo:\n  cUSD: ${fmt(yields.cUSD)}\n  cEUR: ${fmt(yields.cEUR)}`;
    }
  } catch {}

  const aaveContext = aavePositions && Object.values(aavePositions).some(v => v > 0)
    ? `\nAave V3 positions (earning yield):\n${Object.entries(aavePositions).map(([t, v]) => `  ${t}: $${v.toFixed(2)}`).join("\n")}`
    : "\nAave V3 positions: none (idle funds not earning yield)";

  // Load market signals (price momentum) from Redis
  let marketContext = "";
  try {
    const raw = await redis.get("mentoguard:market_signals");
    if (raw) {
      const signals = JSON.parse(raw) as { celo24hChange: number };
      const dir = signals.celo24hChange > 0 ? "▲" : "▼";
      const abs = Math.abs(signals.celo24hChange).toFixed(2);
      const sentiment = Math.abs(signals.celo24hChange) > 5
        ? signals.celo24hChange > 0 ? "strong uptrend" : "strong downtrend"
        : Math.abs(signals.celo24hChange) > 2
          ? signals.celo24hChange > 0 ? "mild uptrend" : "mild downtrend"
          : "stable";
      marketContext = `\nMarket signals (24h):\n  CELO: ${dir}${abs}% (${sentiment})`;
    }
  } catch {}

  const context = `
Portfolio value: $${totalUSD.toFixed(2)}
Current allocation:
  cUSD:  ${result.currentAllocation.cUSD.toFixed(2)}% (target: ${config.targetAllocation.cUSD}%)
  cEUR:  ${result.currentAllocation.cEUR.toFixed(2)}% (target: ${config.targetAllocation.cEUR}%)
  cBRL:  ${result.currentAllocation.cBRL.toFixed(2)}% (target: ${config.targetAllocation.cBRL}%)
  cREAL: ${result.currentAllocation.cREAL.toFixed(2)}% (target: ${config.targetAllocation.cREAL}%)

Drift from target:
  cUSD:  ${result.drift.cUSD > 0 ? "+" : ""}${result.drift.cUSD.toFixed(2)}%
  cEUR:  ${result.drift.cEUR > 0 ? "+" : ""}${result.drift.cEUR.toFixed(2)}%
  cBRL:  ${result.drift.cBRL > 0 ? "+" : ""}${result.drift.cBRL.toFixed(2)}%
  cREAL: ${result.drift.cREAL > 0 ? "+" : ""}${result.drift.cREAL.toFixed(2)}%

FX rates (USD equivalent):
  cEUR:  $${result.rates.cEUR.toFixed(4)}
  cBRL:  $${result.rates.cBRL.toFixed(4)}
  cREAL: $${result.rates.cREAL.toFixed(4)}

User rules:
  Drift threshold: ${config.driftThreshold}%
  Max single swap: $${config.rules.maxSwapAmountUSD}
  Max daily volume: $${config.rules.maxDailyVolumeUSD}
${marketContext}
${yieldContext}
${aaveContext}
`.trim();

  const systemPrompt = `You are MentoGuard, an autonomous FX hedging agent for Celo stablecoins.
Your job is to analyze the portfolio, weigh market conditions, and call the right tool.

Decision rules:
1. If ANY token drift EXCEEDS the threshold AND portfolio value > $0: call execute_swap. Sell the most overweight token, buy the most underweight. Amount = min(overweight USD value, max single swap).
   - Exception: if CELO is in a strong downtrend (>5% down 24h) and you would be buying CELO, consider whether the FX hedge benefit outweighs the momentum risk. If drift is only slightly above threshold (< 2x threshold), you MAY hold and send_alert instead.
2. If drift is between 80%-100% of threshold: call send_alert only.
3. If all drift is below 80% of threshold AND idle stablecoins are not earning yield: call deposit_to_aave to put idle cUSD or cEUR to work. Only if Aave positions < 50% of that token's wallet balance.
4. If all drift is below 80% of threshold AND funds are already in Aave: call hold.

Market timing guidance:
- Strong uptrend (>5% 24h): rebalancing into CELO is favorable — act on smaller drift.
- Strong downtrend (>5% 24h): rebalancing into CELO carries momentum risk — require drift to clearly exceed threshold.
- Stable market: follow the standard drift rules strictly.

IMPORTANT: If drift exceeds threshold, default is execute_swap. Only override with send_alert if market conditions are extreme and drift is marginal.

Before calling a tool, briefly state your reasoning in 1-2 sentences — what you observe, what the market signals suggest, and why you chose this action over alternatives.`;

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

  // Capture and persist Hermes's reasoning text (shown in dashboard activity feed)
  const reasoning = data.choices[0]?.message?.content;
  if (reasoning?.trim()) {
    await redis.set("mentoguard:last_reasoning", JSON.stringify({
      text: reasoning.trim(),
      timestamp: Date.now(),
    }), "EX", 300);
    console.log(`[llm] Hermes reasoning: ${reasoning.trim().slice(0, 120)}...`);
  }

  const toolCalls = data.choices[0]?.message?.tool_calls;
  if (!toolCalls?.length) {
    return [{ action: "hold", reason: "No tool calls returned by Hermes" }];
  }

  const decisions: AgentDecision[] = [];
  for (const call of toolCalls) {
    const args = JSON.parse(call.function.arguments);
    if (call.function.name === "execute_swap") {
      decisions.push({ action: "execute_swap", ...args });
    } else if (call.function.name === "send_alert") {
      decisions.push({ action: "send_alert", ...args });
    } else if (call.function.name === "deposit_to_aave" || call.function.name === "withdraw_from_aave") {
      decisions.push({ action: call.function.name, token: args.token, amountUSD: args.amountUSD, reason: args.reason });
    } else {
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

  const contextBlock = `Portfolio value: $${totalUSD.toFixed(2)}
Allocation: cUSD ${result.currentAllocation.cUSD.toFixed(1)}%, cEUR ${result.currentAllocation.cEUR.toFixed(1)}%, cBRL ${result.currentAllocation.cBRL.toFixed(1)}%, cREAL ${result.currentAllocation.cREAL.toFixed(1)}%
Drift: ${Object.entries(result.drift).map(([t, d]) => `${t}: ${(d as number) > 0 ? "+" : ""}${(d as number).toFixed(1)}%`).join(", ")}
FX rates: cEUR=$${result.rates.cEUR.toFixed(4)}, cBRL=$${result.rates.cBRL.toFixed(4)}
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
        { role: "system", content: "You are MentoGuard, an autonomous FX hedging agent for Mento stablecoins on Celo. Be concise and precise. No markdown." },
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
