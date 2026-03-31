# FlowVault — Human × Agent Collaboration Log

A record of the key decisions, pivots, and breakthroughs from building FlowVault.

> **Note:** FlowVault is a targeted fork of MentoGuard, a working autonomous FX hedging agent deployed on Celo mainnet. This log documents the original MentoGuard development journey and the subsequent adaptation to Flow.

---

## Phase 1 — MentoGuard (Original Build)

### Day 1 — Scaffolding and First Swap

**Human:** Scaffold a monorepo for an autonomous FX hedging agent on Celo. It should watch stablecoin balances, rebalance via Mento Broker, and notify via Telegram.

**Agent:** Built the monorepo structure: `apps/web` (Next.js 15 dashboard), `apps/telegram` (Telegraf bot), `packages/agent-core` (cron agent), `packages/shared` (types/constants). Wired up the observe → decide → act loop with Hermes LLM function calling.

**First confirmed on-chain swap:** CELO → cUSD — Celo Mainnet. 13+ autonomous transactions followed.

### The Oracle Problem

Oracle feed issues on Mento cEUR forced a pivot — agent was retried redesigned to use CELO/cUSD as the primary rebalancing pair. Later, cEUR oracle came back live, enabling full FX hedging.

### Building the Yield Layer

Added Aave V3 deposit/withdraw on Celo, DeFiLlama APY fetching, and yield tools for the LLM. Dual-role portfolio: CELO hedges FX exposure, stablecoins earn yield.

### Making the LLM Earn Its Place

Fed real market data (CELO 24h price momentum) to Hermes so it makes timing decisions that a simple if-else cannot make. Market-aware rebalancing: delay buying into downtrends, accelerate in uptrends.

---

## Phase 2 — FlowVault (Flow Adaptation)

### Chain Swap

**Human:** Fork MentoGuard for the Flow Future of Finance Hackathon. Adapt the agent for DAO treasury management on Flow EVM.

**Agent:** Executed a systematic rename pass:
- All `@mentoguard/` imports → `@flowvault/`
- Chain client: Celo → Flow EVM (Chain ID 747)
- Price feeds: CoinGecko/Frankfurter → Pyth Network on Flow
- DEX: Mento Broker → IncrementFi Router
- Token set: cUSD/cEUR/CELO → FLOW/USDC/USDT/stFLOW
- Redis namespaces: `mentoguard:*` → `flowvault:*`

### Scope Upgrade — Personal → DAO

**Human:** This needs to be a DAO treasury manager, not a personal portfolio tool.

**Agent:** Added:
- `DAOConfig` type with expense schedules and multi-sig signers
- `reserve_expense` tool for the AI — ring-fences stablecoins before rebalancing
- Expense context fed to Hermes: "DAO needs $45,000 USDC by April 30 — 32 days away"

### Cadence Contracts

Rewrote the Solidity guardrails as Cadence contracts:
- **DelegationRules.cdc** — same 6 rules, but enforced by the type system
- **TreasuryAccount.cdc** — emits `AgentDecision` events with plain-English reasoning
- **ExpenseReserve.cdc** — DAO runway protection
- **DAOMultiSig.cdc** — 2-of-3 approval for large rebalances

### Treasury Dashboard

Built `/dashboard/treasury` page — expense schedule, reserve coverage bar, runway metrics, yield earnings. Added Treasury to navigation.

---

## What Was Built

A production-quality autonomous DAO treasury agent:

- **AI decision engine** (Hermes-4-70B) with 6 tools and market-aware reasoning
- **Cadence guardrails** — rules enforced by Flow's type system, not `require()` statements
- **Expense protection** — AI ring-fences stablecoins for upcoming DAO payments
- **Yield optimization** — idle stablecoins deployed to IncrementFi vaults
- **On-chain audit trail** — every decision emitted as a Flow event with plain-English reasoning
- **Filecoin logging** — every tick permanently stored via Lighthouse
- **Live dashboard** — portfolio, treasury, rules, activity feed
- **Telegram control** — natural language configuration and real-time alerts

The core innovation: **constrained autonomy**. The AI decides. The chain enforces. The audit trail is permanent.
