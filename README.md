# MentoGuard

**An AI agent that cannot exceed the rules you set on-chain. Autonomy with a hard limit.**

AI agents acting on your money is terrifying. You can't audit an LLM. You can't trust it won't go rogue. The solution isn't better AI — it's constraining the AI with rules it physically cannot bypass.

MentoGuard is a live, autonomous DeFi agent running on Celo mainnet. Every action it takes is validated against rules stored on-chain before execution. The LLM decides. The chain enforces.

**Live Demo:** https://mentoguard.vercel.app
**Telegram Bot:** [@MentoGuardBot](https://t.me/MentoGuardBot)
**13+ confirmed mainnet transactions — all within user-defined on-chain limits.**

---

## The Problem

Autonomous AI agents managing real money introduce a new class of risk: the agent acts faster than you can react. An LLM that decides to "rebalance aggressively" at 3am, or drains a wallet chasing yield, is not science fiction — it's the default behavior of any unconstrained agent.

The standard answer is off-chain guardrails: environment variables, middleware checks, rate limits in code. These are breakable. They live in the same process as the agent. They can be overridden by a sufficiently persuasive prompt.

**MentoGuard's answer: put the rules on-chain, where the agent has to read them before every action.**

---

## The Solution: Constrained Autonomy

MentoGuard separates the decision layer from the permission layer:

```
LLM decides what to do → Chain verifies it's allowed → Agent executes (or refuses)
```

Rules are stored in the **MentoGuardRules** smart contract on Celo mainnet. The agent reads them every tick. It cannot execute a swap that violates them — not because of an `if` statement in application code, but because the contract is the authority.

```typescript
// delegation.ts — called before every swap
const rules = await readRulesFromChain();

if (amountUSD > rules.maxSwapAmountUSD) {
  throw new Error(`Swap $${amountUSD} exceeds on-chain limit $${rules.maxSwapAmountUSD}`);
}
if (dailyVolume + amountUSD > rules.maxDailyVolumeUSD) {
  throw new Error(`Daily volume limit reached`);
}
if (!rules.allowedTokens.includes(tokenIn)) {
  throw new Error(`Token not in on-chain allowlist`);
}
```

The owner can update rules or pause the agent via on-chain transaction. The agent respects the change within 60 seconds — no redeployment, no restart.

### On-Chain Rules (MentoGuardRules contract)

```typescript
{
  maxSwapAmountUSD: 500,        // Max single swap — enforced on-chain
  maxDailyVolumeUSD: 2000,      // Max daily trading volume — enforced on-chain
  allowedTokens: [              // Token allowlist — enforced on-chain
    "0x765DE8...",  // cUSD
    "0xD8763C...",  // cEUR
    "0x471ECE...",  // CELO
  ],
  driftThreshold: 500,          // 5% — minimum drift before rebalancing
  isPaused: false               // Emergency stop — one tx to halt everything
}
```

**MentoGuardRules contract:** `0xba26522a9221a3de4234e8d5e8d52bd8216932c8` — Celo Mainnet
**Deploy tx:** `0xb615a4f5c3d7443d6302be0c1c8b0213cb7cca77206d32a67f72c77b76ae2b22`

---

## Identity Layer: Self Protocol

Users verify their identity via Self Protocol's ZK passport verification. Verified status unlocks higher delegation limits — the agent trusts real humans with more autonomy.

This creates a graduated trust model:
- **Unverified:** conservative limits ($100 max swap, $500 daily)
- **Self-verified human:** full limits ($500 max swap, $2000 daily)

Verification is stored on-chain. The agent reads it. No off-chain config needed.

---

## Audit Trail: Filecoin

Every tick and every decision is logged to Filecoin via Lighthouse Storage — a permanent, tamper-proof record of what the agent did, when, and why.

This is not optional telemetry. It's accountability infrastructure. If the agent acts unexpectedly, you can pull the exact context it received and the exact decision it made.

**Verified Filecoin CIDs — every autonomous decision permanently stored:**

| Type | CID |
|---|---|
| Tick log (FX rates + drift) | `bafkreih5gfotjtl6nm6ja7bcjepzvcjbblpwy6y6dxonxoilyala7244iq` |
| Rebalance log + tx hash | `bafkreigmn2s7whz4knzpt2nsz3a74ybrvakoceqfbylqpgfzjwkngacjwa` |
| Rebalance log + tx hash | `bafkreiaivq53qg67hyqtjiq3awasdjxqrbd3nh7dg4iyacew5vi7fpv4tu` |
| Rebalance log + tx hash | `bafkreia22xedp6c3ml3kegpijnmjvpwke4prwbjajxpkdxhdwatka2bqey` |
| Rebalance log + tx hash | `bafkreifhianh4x55h7hepzadoem7ajtaegybie37pzw2ospnrlfn25yz6u` |
| Rebalance log + tx hash | `bafkreicypu3e5qgfyndn7wu7d5ang57udx3q24rvqkzzhhek5ukdrgziii` |

All retrievable at `https://gateway.lighthouse.storage/ipfs/<CID>`

---

## What the Agent Does

Within its constrained permission set, MentoGuard runs a continuous **observe → decide → act** loop every 60 seconds:

1. **Observe** — Fetches live FX rates (EUR/USD, BRL/USD), reads on-chain token balances (cUSD, cEUR, CELO), checks Aave V3 yield positions, fetches DeFiLlama APY data.

2. **Decide** — Passes full portfolio context to Hermes (NousResearch Hermes-4-70B) via function calling. Hermes weighs portfolio drift, FX rates, 24h CELO price momentum, and yield opportunities. Makes a market-aware decision: not just "drift > threshold → swap" but "drift > threshold AND momentum is favorable → swap."

3. **Act** — Executes on-chain within the rules:
   - Swaps via **Mento Broker** (`0x777A8255cA72412f0d706dc03C9D1987306B4CaD`) with automatic two-hop fallback via CELO
   - Deposits to / withdraws from **Aave V3 on Celo** to earn yield on idle stablecoins
   - Sends **Telegram notifications** for every action
   - Logs every decision to **Filecoin**

### Agent Decision Logic

Hermes receives this context every tick:

```
Portfolio value: $X.XX
Current allocation:
  cUSD:  XX.XX% (target: 45%)
  cEUR:  XX.XX% (target: 10%)
  CELO:  XX.XX% (target: 45%)

Drift from target:
  cUSD:  +X.XX%
  CELO:  +X.XX%

FX rates: cEUR=$1.1555, CELO=$0.48
Market signals (24h): CELO ▼3.21% (mild downtrend)
Aave V3 positions: cUSD $0.62 earning yield
On-chain rules: maxSwap=$500, dailyVolume=$2000, paused=false
```

Decision outcomes:
- **CELO drifting + downtrend** → hold, send alert
- **CELO drifting + uptrend** → rebalance immediately
- **Portfolio balanced + stablecoins idle** → deploy to Aave
- **Rebalance needed + funds in Aave** → withdraw from Aave, then swap

---

## Confirmed On-Chain Activity

All transactions on Celo Mainnet. All within on-chain limits. All logged to Filecoin.

| Action | Tx Hash |
|---|---|
| CELO → cUSD | `0xe01b1a140bfd2c9727f41b0c068689d494a17bdc4fecb7ade66ef29f9c3f87a0` |
| cUSD → cEUR | `0xacca0898d48e68cde32be6dbdb22fbc416b3928d26b03b883b5f4bb82862417a` |
| cUSD → cEUR | `0x9afb15a9472ed380158d712a8f57891621c91a8ba6f749a7d405dc582d04d70e` |
| cUSD → cEUR | `0x7e8481fc98f51544292a4ea2e708b22999754144d5e19e93b3aece28856a6894` |
| cUSD → cEUR | `0xc74ab042110259de1d1050f630cb376addfe2125816f077a896236f1a009610b` |
| CELO → cUSD | `0xaf1a90a9075c6476157d520b333cf9ce08ce5459206bd96076d1a8ce242ba004` |
| cUSD → cEUR | `0x09a8503d2f3ebbf94bec9b8c4c73a5dd6c871c5c52ec1d0765b9b1f4000ba8af` |
| CELO → cUSD | `0xef34e1de907c4206de5af4d7f036615e60c2f03d148b18f567502096dcf2f5f0` |
| cUSD → cEUR | `0x29477d43e85eef6db5c8530808e20cf7ac2e3c50c695caeb36da191978b2f78c` |
| CELO → cUSD | `0x8228bbc56123a286cb209a4ecf7d169946570e1960bc80a868fed7c12ba942be` |
| CELO → cUSD | `0x0fffcce0e9b631a3720c255eea97f48f0be6a0d3a3d6ca55cba04e0fbb185809` |
| CELO → cUSD | `0x9e6649d2b4798c25931f906515465d47c634a115d2897708fbbfee24475ef5ff` |
| cUSD → Aave V3 (yield) | `0xeba6b17715d3185becdc816d924f60cb8ceecdcd38eda06b2c740b298f44408c` |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MentoGuard Agent                            │
│                                                                     │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────────────┐   │
│  │ Monitor  │───▶│  Hermes LLM  │───▶│ Delegation Check         │   │
│  │          │    │  (Decide)    │    │ (reads MentoGuardRules)  │   │
│  │ FX Rates │    │  Function    │    └────────────┬─────────────┘   │
│  │ Balances │    │  Calling     │                 │ allowed?        │
│  │ Aave Pos │    └──────────────┘                 ▼                 │
│  │ DeFi APY │                          ┌──────────────────────────┐ │
│  └──────────┘                          │ Executor                 │ │
│                                        │ Mento Broker (swap)      │ │
│                                        │ Aave V3 (yield)          │ │
│                                        │ Filecoin (log)           │ │
│                                        └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
         │                                              │
         ▼                                              ▼
   Redis (state)                              Celo Mainnet
   Telegram (alerts)                          (transactions)
   Dashboard (UI)
```

### Monorepo Structure

```
mentoguard/
├── apps/
│   ├── web/              # Next.js 15 dashboard (Vercel)
│   └── telegram/         # Telegraf bot (Railway)
├── packages/
│   ├── agent-core/       # Agent loop, LLM, execution (Railway)
│   │   └── src/
│   │       ├── index.ts       # Main cron loop (60s)
│   │       ├── monitor.ts     # FX rates, balances, yields
│   │       ├── llm.ts         # Hermes function calling
│   │       ├── executor.ts    # Swap orchestration
│   │       ├── mento.ts       # Mento Broker integration
│   │       ├── aave.ts        # Aave V3 deposit/withdraw
│   │       ├── strategy.ts    # Rebalance calculation
│   │       ├── delegation.ts  # On-chain rule validation ← the core constraint
│   │       └── memory.ts      # Redis + Filecoin logging
│   └── shared/           # Types, constants, utilities
├── contracts/            # MentoGuardRules (Foundry)
```

---

## Technologies

| Technology | Role |
|---|---|
| **MentoGuardRules (Solidity)** | On-chain permission layer — the hard constraint the agent cannot bypass |
| **Self Protocol** | ZK passport verification — graduated trust, verified humans unlock higher limits |
| **Filecoin / Lighthouse** | Immutable audit trail — every decision permanently logged |
| **Mento Protocol** | Stablecoin swaps (cUSD, cEUR, CELO) via Broker contract |
| **Aave V3 (Celo)** | Yield on idle stablecoins |
| **NousResearch Hermes-4-70B** | LLM decision engine — function calling |
| **Celo Mainnet** | All execution — Chain ID 42220 |
| **Redis (Upstash)** | Shared state between agent, dashboard, Telegram |
| **Next.js 15** | Dashboard — portfolio, FX heatmap, activity feed |
| **Telegraf** | Telegram bot — natural language commands, alerts |
| **viem** | On-chain reads and writes |

---

## Deployed Contracts

| Contract | Address | Network |
|---|---|---|
| **MentoGuardRules** | `0xba26522a9221a3de4234e8d5e8d52bd8216932c8` | Celo Mainnet |
| Mento Broker | `0x777A8255cA72412f0d706dc03C9D1987306B4CaD` | Celo Mainnet |
| Aave V3 Pool | `0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402` | Celo Mainnet |
| cUSD (USDm) | `0x765DE816845861e75A25fCA122bb6898B8B1282a` | Celo Mainnet |
| cEUR (EURm) | `0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73` | Celo Mainnet |
| CELO (ERC-20) | `0x471EcE3750Da237f93B8E339c536989b8978a438` | Celo Mainnet |

---

## Live API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/portfolio` | Current token balances and USD values |
| `GET /api/fx-rates` | Live FX rates (cUSD, cEUR, cBRL, CELO) |
| `GET /api/yields` | Top Celo DeFi APY opportunities from DeFiLlama |
| `GET /api/activity` | Recent agent decisions and Filecoin CIDs |
| `GET /api/agent-state` | Agent status, uptime, total trades |
| `POST /api/authorize` | Update delegation rules and target allocation |

---

## Running Locally

### Prerequisites
- Node.js >= 20, pnpm >= 9
- A Celo wallet with private key
- Redis instance (Upstash free tier)
- NousResearch API key (Hermes)

### Setup

```bash
git clone https://github.com/Calebux/Mentoguard.git
cd mentoguard
pnpm install
```

Copy `.env.example` to `.env`:

```env
CELO_PRIVATE_KEY=0x...
CELO_SMART_ACCOUNT_ADDRESS=0x...
CELO_RPC_URL=https://forno.celo.org
HERMES_BASE_URL=https://inference-api.nousresearch.com/v1
HERMES_API_KEY=...
HERMES_MODEL=Hermes-4-70B
REDIS_URL=rediss://...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
LIGHTHOUSE_API_KEY=...
```

### Run

```bash
pnpm --filter @mentoguard/web dev        # Dashboard on port 3003
tsx packages/agent-core/src/index.ts    # Agent cron loop
tsx apps/telegram/src/bot.ts            # Telegram bot
```

---

## Telegram Bot Commands

```
/status    — Agent health, uptime, total trades
/portfolio — Current allocation and drift
/pause     — Halt all autonomous trading
/resume    — Restart autonomous trading
/history   — Last 10 swaps

Natural language:
"set target to 70% cUSD 30% cEUR"
"set threshold to 3%"
"pause trading until Monday"
```

---

## Hackathon Submission

Built for the **Synthesis Agent Hack**.

The central thesis: **the most important property of an autonomous agent managing real assets is not intelligence — it is constraint.** MentoGuard demonstrates the pattern: a capable LLM decision layer operating under hard on-chain limits that neither the agent nor a malicious prompt can bypass. Every action is audited to Filecoin. Every operator is verified via Self Protocol.

This is not a demo. It is a running system with a live transaction history.
