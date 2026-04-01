/**
 * agent-tick.ts
 *
 * Core Hermes AI tick logic extracted as a plain async function so it can be
 * called directly from the scheduler (no HTTP round-trip) and from the API route.
 *
 * Each tick:
 *  1. Reads portfolio state from Redis (or uses demo context)
 *  2. Calls Hermes 4 70B with 5 tools
 *  3. Saves reasoning to Redis rolling log
 *  4. Uploads the decision JSON to Filecoin via Lighthouse → real CID
 *  5. Simulates portfolio evolution so the next tick sees different context
 */

import redis from "@/lib/redis";
import { uploadToLighthouse } from "@/lib/filecoin";
import { DEFAULT_DELEGATION_RULES } from "@flowvault/shared";

const BASE_URL = process.env.HERMES_BASE_URL ?? "https://inference-api.nousresearch.com/v1";
const API_KEY  = process.env.HERMES_API_KEY ?? "";
const MODEL    = process.env.HERMES_MODEL   ?? "hermes-4-70b";

const DEFAULT_TARGET = { FLOW: 25, USDC: 50, USDT: 15, stFLOW: 10 };

const TOOLS = [
  { type: "function", function: { name: "execute_swap",    description: "Execute a token swap to rebalance the DAO treasury.", parameters: { type: "object", properties: { fromToken: { type: "string", enum: ["FLOW","USDC","USDT","stFLOW"] }, toToken: { type: "string", enum: ["FLOW","USDC","USDT","stFLOW"] }, amountUSD: { type: "number" }, reason: { type: "string" } }, required: ["fromToken","toToken","amountUSD","reason"] } } },
  { type: "function", function: { name: "reserve_expense", description: "Ring-fence stablecoins for an upcoming DAO expense before rebalancing.", parameters: { type: "object", properties: { token: { type: "string", enum: ["USDC","USDT"] }, amountUSD: { type: "number" }, reason: { type: "string" }, daysUntilNeeded: { type: "number" } }, required: ["token","amountUSD","reason","daysUntilNeeded"] } } },
  { type: "function", function: { name: "deposit_to_yield", description: "Deposit idle stablecoins into a Flow yield protocol.", parameters: { type: "object", properties: { token: { type: "string", enum: ["USDC","USDT"] }, amountUSD: { type: "number" }, reason: { type: "string" } }, required: ["token","amountUSD","reason"] } } },
  { type: "function", function: { name: "send_alert",      description: "Send a Telegram alert to the DAO admin.", parameters: { type: "object", properties: { message: { type: "string" }, severity: { type: "string", enum: ["info","warning","critical"] } }, required: ["message","severity"] } } },
  { type: "function", function: { name: "hold",            description: "Take no action this tick.", parameters: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"] } } },
];

type Allocation = { FLOW: number; USDC: number; USDT: number; stFLOW: number };

function getDemoContext(target: Allocation, threshold: number) {
  const prices = { FLOW: 0.74, USDC: 1.0, USDT: 1.0, stFLOW: 0.777 };
  const totalUSD = 842000;
  const current: Allocation = { FLOW: 36.4, USDC: 39.3, USDT: 14.3, stFLOW: 10.0 };
  const drift = { FLOW: current.FLOW - target.FLOW, USDC: current.USDC - target.USDC, USDT: current.USDT - target.USDT, stFLOW: current.stFLOW - target.stFLOW };
  return { prices, totalUSD, current, drift, shouldRebalance: Math.max(...Object.values(drift).map(Math.abs)) > threshold };
}

export interface TickResult {
  action: string;
  toolArgs: Record<string, unknown>;
  reasoning: string;
  drift: Allocation;
  shouldRebalance: boolean;
  filecoinCid: string | null;
}

export async function runTick(): Promise<TickResult> {
  // ── Load config ──────────────────────────────────────────────────────────────
  let targetAllocation = DEFAULT_TARGET;
  let driftThreshold   = 5;
  try {
    const cfg = await redis.get("flowvault:user_config");
    if (cfg) { const c = JSON.parse(cfg); if (c.targetAllocation) targetAllocation = { ...DEFAULT_TARGET, ...c.targetAllocation }; if (c.driftThreshold) driftThreshold = c.driftThreshold; }
  } catch { /* defaults */ }

  let prices = { FLOW: 0.74, USDC: 1.0, USDT: 1.0, stFLOW: 0.777 };
  try { const p = await redis.get("flowvault:token_prices"); if (p) prices = { ...prices, ...JSON.parse(p) }; } catch { /* defaults */ }

  // ── Portfolio state ───────────────────────────────────────────────────────────
  let totalUSD = 0, current: Allocation = { FLOW: 0, USDC: 0, USDT: 0, stFLOW: 0 }, drift: Allocation = { FLOW: 0, USDC: 0, USDT: 0, stFLOW: 0 }, shouldRebalance = false;
  try {
    const raw = await redis.get("flowvault:last_tick");
    if (raw) {
      const t = JSON.parse(raw);
      totalUSD = t.balances?.reduce((s: number, b: { balanceUSD: number }) => s + b.balanceUSD, 0) ?? 0;
      if (totalUSD > 0 && t.currentAllocation && t.drift) { current = t.currentAllocation; drift = t.drift; shouldRebalance = t.shouldRebalance ?? false; }
    }
  } catch { /* ignore */ }
  if (totalUSD === 0) { const d = getDemoContext(targetAllocation, driftThreshold); prices = d.prices; totalUSD = d.totalUSD; current = d.current; drift = d.drift; shouldRebalance = d.shouldRebalance; }

  // ── Extra context ─────────────────────────────────────────────────────────────
  let marketContext = "";
  try { const raw = await redis.get("flowvault:market_signals"); if (raw) { const s = JSON.parse(raw); const dir = s.flow24hChange > 0 ? "▲" : "▼"; marketContext = `\nMarket signals (24h):\n  FLOW: ${dir}${Math.abs(s.flow24hChange).toFixed(2)}%`; } } catch { /* ignore */ }

  let yieldContext = "";
  try { const raw = await redis.get("flowvault:yield_rates"); if (raw) { const y = JSON.parse(raw); const fmt = (ops: { protocol: string; apy: number }[]) => ops?.length ? ops.map(o => `${o.protocol} ${o.apy.toFixed(2)}% APY`).join(", ") : "none"; yieldContext = `\nFlow yield:\n  USDC: ${fmt(y.USDC||[])}\n  USDT: ${fmt(y.USDT||[])}`; } } catch { /* ignore */ }

  let expenseContext = "";
  try { const raw = await redis.get("flowvault:dao_expenses"); if (raw) { const now = Date.now(); const lines = (JSON.parse(raw) as { description: string; amountUSD: number; token: string; dueDate: number }[]).filter(e => e.dueDate > now).slice(0, 4).map(e => `  - ${e.description}: $${e.amountUSD.toLocaleString()} ${e.token} in ${Math.ceil((e.dueDate - now) / 86400_000)}d`); if (lines.length) expenseContext = `\nDAO upcoming expenses:\n${lines.join("\n")}`; } } catch { /* ignore */ }

  const context = `Portfolio value: $${totalUSD.toLocaleString("en-US", { maximumFractionDigits: 0 })}
Current allocation:
  FLOW:   ${current.FLOW.toFixed(2)}% (target: ${targetAllocation.FLOW}%)
  USDC:   ${current.USDC.toFixed(2)}% (target: ${targetAllocation.USDC}%)
  USDT:   ${current.USDT.toFixed(2)}% (target: ${targetAllocation.USDT}%)
  stFLOW: ${current.stFLOW.toFixed(2)}% (target: ${targetAllocation.stFLOW}%)
Drift: FLOW ${drift.FLOW > 0 ? "+" : ""}${drift.FLOW.toFixed(2)}%  USDC ${drift.USDC > 0 ? "+" : ""}${drift.USDC.toFixed(2)}%  USDT ${drift.USDT > 0 ? "+" : ""}${drift.USDT.toFixed(2)}%  stFLOW ${drift.stFLOW > 0 ? "+" : ""}${drift.stFLOW.toFixed(2)}%
Threshold: ${driftThreshold}%${marketContext}${yieldContext}${expenseContext}`;

  const systemPrompt = `You are FlowVault, an autonomous treasury management agent for Flow DAOs. Analyze the portfolio and call the right tool. Every reason string is stored as a permanent Filecoin record — be specific and auditable. If ANY drift exceeds threshold, call execute_swap. If balanced and idle USDC/USDT exist, call deposit_to_yield. Otherwise hold.`;

  // ── Call Hermes ───────────────────────────────────────────────────────────────
  let reasoning = "";
  let action    = "hold";
  let toolArgs: Record<string, unknown> = { reason: "Portfolio within acceptable bounds" };

  if (API_KEY) {
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({ model: MODEL, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: context }], tools: TOOLS, tool_choice: "auto", temperature: 0.2, max_tokens: 1024 }),
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) {
        const data = await res.json() as { choices: { message: { content?: string; tool_calls?: { function: { name: string; arguments: string } }[] } }[] };
        reasoning = data.choices[0]?.message?.content ?? "";
        const tc = data.choices[0]?.message?.tool_calls;
        if (tc?.length) { action = tc[0].function.name; toolArgs = JSON.parse(tc[0].function.arguments); }
      }
    } catch { /* fall through to deterministic fallback */ }
  }

  if (!reasoning) {
    if (shouldRebalance) {
      const [fromToken] = Object.entries(drift).sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))[0];
      const [toToken]   = Object.entries(drift).sort(([, a], [, b]) => a - b)[0];
      const dAbs = Math.abs(drift[fromToken as keyof Allocation]).toFixed(1);
      reasoning = `${fromToken} has drifted +${dAbs}% above its ${targetAllocation[fromToken as keyof typeof targetAllocation]}% target, exceeding the ${driftThreshold}% threshold. Executing rebalance to restore target allocation while protecting DAO expense reserves.`;
      action = "execute_swap";
      toolArgs = { fromToken, toToken, amountUSD: Math.min(500, (Math.abs(drift[fromToken as keyof Allocation]) / 100) * totalUSD * 0.5), reason: `${fromToken} drifted +${dAbs}% above target — rebalancing to ${toToken}` };
    } else {
      reasoning = `All allocations within ${driftThreshold}% threshold. Max drift: ${Math.max(...Object.values(drift).map(Math.abs)).toFixed(1)}%. Monitoring conditions.`;
    }
  }

  // ── Guardrail check ───────────────────────────────────────────────────────────
  // Load on-chain delegation rules from Redis (set by the Rules page)
  let rules = DEFAULT_DELEGATION_RULES;
  try {
    const rulesRaw = await redis.get("flowvault:delegation_rules");
    if (rulesRaw) rules = { ...DEFAULT_DELEGATION_RULES, ...JSON.parse(rulesRaw) };
  } catch { /* use defaults */ }

  let guardrailBlocked = false;
  let guardrailReason  = "";

  if (action === "execute_swap") {
    const swapAmount = (toolArgs.amountUSD as number) ?? 0;
    const nowHour    = new Date().getUTCHours();

    if (swapAmount > rules.maxSwapAmountUSD) {
      guardrailBlocked = true;
      guardrailReason  = `BLOCKED by guardrail: swap $${swapAmount.toFixed(0)} exceeds max single-swap limit ($${rules.maxSwapAmountUSD}). Reduce size or raise the limit in Rules.`;
    } else if (nowHour < rules.timeWindow.startHour || nowHour >= rules.timeWindow.endHour) {
      guardrailBlocked = true;
      guardrailReason  = `BLOCKED by guardrail: current hour (${nowHour}:00 UTC) is outside the allowed trading window (${rules.timeWindow.startHour}:00–${rules.timeWindow.endHour}:00 UTC).`;
    } else if (swapAmount >= rules.requireHumanApprovalAbove) {
      guardrailBlocked = true;
      guardrailReason  = `BLOCKED by guardrail: swap $${swapAmount.toFixed(0)} requires multi-sig approval (threshold: $${rules.requireHumanApprovalAbove}). Waiting for DAO signers.`;
    } else {
      // Track daily volume
      const volKey  = "flowvault:daily_volume";
      const dailyVol = parseFloat((await redis.get(volKey)) ?? "0");
      if (dailyVol + swapAmount > rules.maxDailyVolumeUSD) {
        guardrailBlocked = true;
        guardrailReason  = `BLOCKED by guardrail: daily volume cap reached ($${(dailyVol + swapAmount).toFixed(0)} would exceed $${rules.maxDailyVolumeUSD} limit).`;
      } else {
        // Increment daily volume counter (TTL resets at 24h)
        await redis.set(volKey, (dailyVol + swapAmount).toFixed(2), "EX", 86400);
      }
    }

    if (guardrailBlocked) {
      action    = "blocked_by_guardrail";
      reasoning = guardrailReason;
      toolArgs  = { reason: guardrailReason };
    }
  }

  // ── Upload to Filecoin ────────────────────────────────────────────────────────
  const filecoinPayload = { action, reasoning, toolArgs, drift, portfolio: { totalUSD, currentAllocation: current, targetAllocation }, timestamp: Date.now(), agent: "FlowVault Hermes 4 70B" };
  const filecoinCid = await uploadToLighthouse(filecoinPayload);

  // ── Simulate portfolio evolution ──────────────────────────────────────────────
  const next = { ...current };
  if (action === "execute_swap" && toolArgs.fromToken && toolArgs.toToken) {
    const from = toolArgs.fromToken as keyof Allocation;
    const to   = toolArgs.toToken   as keyof Allocation;
    const swapPct = Math.min(((toolArgs.amountUSD as number) / totalUSD) * 100, Math.abs(drift[from]));
    next[from] = Math.max(0, current[from] - swapPct * 0.85);
    next[to]   = Math.min(100, current[to]   + swapPct * 0.85);
  } else {
    next.FLOW   = Math.min(42, current.FLOW   + 0.4);
    next.USDC   = Math.max(28, current.USDC   - 0.28);
    next.USDT   = Math.max(8,  current.USDT   - 0.08);
    next.stFLOW = Math.max(6,  current.stFLOW - 0.04);
  }
  const tot = Object.values(next).reduce((s, v) => s + v, 0);
  (Object.keys(next) as (keyof Allocation)[]).forEach(k => { next[k] = parseFloat(((next[k] / tot) * 100).toFixed(2)); });
  const nextDrift: Allocation = { FLOW: parseFloat((next.FLOW - targetAllocation.FLOW).toFixed(2)), USDC: parseFloat((next.USDC - targetAllocation.USDC).toFixed(2)), USDT: parseFloat((next.USDT - targetAllocation.USDT).toFixed(2)), stFLOW: parseFloat((next.stFLOW - targetAllocation.stFLOW).toFixed(2)) };
  const nextShouldRebalance = Math.max(...Object.values(nextDrift).map(Math.abs)) > driftThreshold;

  // ── Persist to Redis ──────────────────────────────────────────────────────────
  const reasoningEntry = JSON.stringify({ text: reasoning, action, timestamp: Date.now(), filecoinCid });
  await redis.lpush("flowvault:reasoning_log", reasoningEntry);
  await redis.ltrim("flowvault:reasoning_log", 0, 49);
  await redis.set("flowvault:last_reasoning", reasoningEntry, "EX", 3600);

  if (filecoinCid) {
    await redis.lpush("flowvault:rebalance_cids", filecoinCid);
    await redis.ltrim("flowvault:rebalance_cids", 0, 49);
  }

  await redis.set("flowvault:last_tick", JSON.stringify({
    rates: prices,
    balances: [
      { token: "FLOW",   address: "0xd3bF53DAC106A0290B0483EcBC89d40FcC961f3e", balanceUSD: (next.FLOW   / 100) * totalUSD },
      { token: "USDC",   address: "0xF1815bd50389c46847f0Bda824eC8da914045D14", balanceUSD: (next.USDC   / 100) * totalUSD },
      { token: "USDT",   address: "0x674843C06FF83502ddb4D37c2E09C01cdA38cbc8", balanceUSD: (next.USDT   / 100) * totalUSD },
      { token: "stFLOW", address: "0x53bDb5D23e5e70B1c0B739b38bCB83b8B8d71e5c", balanceUSD: (next.stFLOW / 100) * totalUSD },
    ],
    currentAllocation: next, drift: nextDrift, shouldRebalance: nextShouldRebalance, tickAt: Date.now(),
  }));
  await redis.set("flowvault:token_prices", JSON.stringify({ ...prices, updatedAt: Date.now() }));

  const stateRaw = await redis.get("flowvault:agent_state");
  const state = stateRaw ? JSON.parse(stateRaw) : { startedAt: Date.now(), totalTrades: 0, totalFeesUSD: 0 };
  await redis.set("flowvault:agent_state", JSON.stringify({ ...state, status: "active", lastTickAt: Date.now(), uptime: state.startedAt ? Math.floor((Date.now() - state.startedAt) / 1000) : 0 }));

  return { action, toolArgs, reasoning, drift: nextDrift, shouldRebalance: nextShouldRebalance, filecoinCid };
}
