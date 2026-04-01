# FlowVault 🏦

**AI-Powered DAO Treasury Manager on Flow**

An autonomous AI agent that manages DAO treasuries on Flow — continuously rebalancing, earning yield on idle capital, and protecting runway for upcoming expenses. Every decision is logged permanently on Filecoin with plain-English reasoning.

---

## The Problem

DAOs collectively hold billions in treasury assets. Most sit idle in multi-sigs, managed manually, earning nothing, with no audit trail for decisions. Rebalancing happens quarterly at best — via governance votes, not market signals.

## The Solution

FlowVault deploys an AI agent (Hermes 4 70B with tool calling) that:

- **Continuously rebalances** to a target allocation within user-defined guardrails
- **Earns yield** on idle stablecoins automatically (IncrementFi lending vaults)
- **Protects runway** by ring-fencing stablecoins for upcoming DAO expenses
- **Logs every decision permanently** on Filecoin via Lighthouse — auditable by anyone
- **Enforces rules via smart contracts** — the agent cannot exceed limits regardless of what the LLM decides

```
AI decides → Guardrail contract verifies → Agent executes (or the contract refuses)
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       USER INTERFACES                            │
│  ┌─────────────────────────────┐  ┌──────────────────────────┐  │
│  │   Next.js Dashboard         │  │   Telegram Bot            │  │
│  │   /dashboard (live feed)    │  │   /status /portfolio      │  │
│  │   /dashboard/treasury       │  │   /history /pause         │  │
│  │   /dashboard/rules          │  │   Push notifications      │  │
│  └─────────────────────────────┘  └──────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      AGENT CORE (Node.js)                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  scheduler — Observe → Decide → Act loop (every 30s)     │   │
│  └──────────────────────────────────────────────────────────┘   │
│         │              │               │              │          │
│         ▼              ▼               ▼              ▼          │
│   monitor.ts      llm.ts          executor.ts    memory.ts      │
│   (Pyth prices)   (Hermes 4 70B   (IncrementFi   (Filecoin      │
│   (Flow EVM)       tool calling)   DEX + rules)   Lighthouse)   │
│                                        │                         │
│                                   delegation.ts                  │
│                                   (reads guardrail contract)     │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    FLOW EVM (Chain ID: 747)                       │
│                                                                  │
│  FlowVaultRules.sol    DelegationRules.cdc    ExpenseReserve.cdc │
│  (6 onchain guardrails) (Cadence version)    (DAO runway lock)   │
│                                                                  │
│  IncrementFi Router     Pyth Oracle          DAOMultiSig.cdc     │
│  (DEX execution)        (Price feeds)        (2-of-3 approval)   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Deployed Contracts

### Solidity — Flow EVM / EVM-Compatible

| Contract | Address | Network | Explorer |
|---|---|---|---|
| **FlowVaultRules** | `0xba26522a9221a3de4234e8d5e8d52bd8216932c8` | Celo Mainnet (42220) | [Celoscan ↗](https://celoscan.io/address/0xba26522a9221a3de4234e8d5e8d52bd8216932c8) |

### Flow EVM Token Addresses (Mainnet — Chain ID 747)

| Token | Address | Description |
|---|---|---|
| **FLOW** | `0xd3bF53DAC106A0290B0483EcBC89d40FcC961f3e` | Wrapped FLOW (ERC-20) |
| **USDC** | `0xF1815bd50389c46847f0Bda824eC8da914045D14` | Bridged USDC |
| **USDT** | `0x674843C06FF83502ddb4D37c2E09C01cdA38cbc8` | Bridged USDT |
| **stFLOW** | `0x53bDb5D23e5e70B1c0B739b38bCB83b8B8d71e5c` | IncrementFi liquid staking |

### Infrastructure (Flow EVM Mainnet)

| Protocol | Address |
|---|---|
| **IncrementFi Router** | `0x8E3B5bc2E2eD1Ff5E4E0B25BeD3F81ECB98a8E8` |
| **Pyth Oracle** | `0x2880aB155794e7179c9eE2e38200202908C17B43` |

### Cadence Contracts — Flow Playground (Account `0x06`)

| Contract | Purpose |
|---|---|
| **DelegationRules.cdc** | 6 guardrail rules enforced at the type-system level |
| **TreasuryAccount.cdc** | Smart account — emits `AgentDecision` event for every action |
| **ExpenseReserve.cdc** | Ring-fences stablecoins for DAO expense schedule |
| **DAOMultiSig.cdc** | 2-of-3 signer approval for rebalances above threshold |

---

## Monorepo Structure

```
flowvault/
├── apps/
│   ├── web/              # Next.js dashboard (Vercel / Railway)
│   └── telegram/         # Telegraf bot
├── packages/
│   ├── agent-core/       # AI agent loop, LLM, execution
│   │   └── src/
│   │       ├── index.ts        # Main cron loop (30s)
│   │       ├── monitor.ts      # Pyth prices, Flow EVM balances
│   │       ├── llm.ts          # Hermes 4 70B function calling (5 tools)
│   │       ├── executor.ts     # Swap orchestration
│   │       ├── increment.ts    # IncrementFi DEX integration
│   │       ├── yield-vaults.ts # ERC-4626 yield vault deposit/withdraw
│   │       ├── strategy.ts     # Rebalance calculation
│   │       ├── delegation.ts   # On-chain rule validation
│   │       └── memory.ts       # Redis + Filecoin logging
│   ├── shared/           # Types, constants, utilities
│   └── contracts/
│       ├── src/                # Solidity (FlowVaultRules.sol)
│       └── cadence/            # Cadence contracts (Flow-native)
│           ├── DelegationRules.cdc
│           ├── TreasuryAccount.cdc
│           ├── ExpenseReserve.cdc
│           ├── DAOMultiSig.cdc
│           └── scripts/       # Cadence query scripts
```

---

## Technologies

| Technology | Role |
|---|---|
| **FlowVaultRules.sol** | Solidity guardrails — max swap, daily volume, time window, multi-sig threshold |
| **DelegationRules.cdc** | Same rules in Cadence — enforced by Flow type system (not `require()`) |
| **TreasuryAccount.cdc** | Smart account with permanent `AgentDecision` event log |
| **ExpenseReserve.cdc** | Ring-fences stablecoins for DAO expenses |
| **DAOMultiSig.cdc** | 2-of-3 approval for large rebalances |
| **Filecoin / Lighthouse** | Immutable audit trail — every AI decision permanently logged with CID |
| **IncrementFi** | DEX swaps on Flow EVM |
| **Pyth Network** | On-chain price oracle (FLOW, USDC, USDT, stFLOW) |
| **NousResearch Hermes-4-70B** | LLM decision engine — structured tool calling, not a chatbot |
| **Flow EVM** | All execution — Chain ID 747 |
| **Redis** | Shared state between agent, dashboard, Telegram |
| **Next.js 15** | Dashboard — portfolio, treasury, activity feed, decision log |

---

## AI Tools (5 Functions)

The AI agent calls one of 5 tools per tick:

| Tool | Action |
|---|---|
| `execute_swap` | Rebalance: sell overweight token, buy underweight |
| `send_alert` | Warn DAO admin without acting |
| `deposit_to_yield` | Deploy idle stablecoins to IncrementFi vaults |
| `reserve_expense` | Ring-fence runway for upcoming DAO payments |
| `hold` | Take no action, log the reason |

Every tool call is checked against guardrail rules before execution. Blocked actions appear in the activity feed as `blocked_by_guardrail` in red.

---

## Running Locally

### Prerequisites
- Node.js >= 20, pnpm >= 9
- Redis instance
- NousResearch API key (Hermes) — optional, falls back to deterministic logic
- Lighthouse API key — optional, enables real Filecoin logging

### Setup

```bash
git clone <repo-url>
cd flowvault
pnpm install
```

Copy `.env.example` to `.env`:

```env
# Agent wallet (optional for demo mode)
FLOW_PRIVATE_KEY=0x...
FLOW_SMART_ACCOUNT_ADDRESS=0x...
FLOW_EVM_RPC_URL=https://mainnet.evm.nodes.onflow.org

# AI engine (optional — falls back to deterministic rebalancing)
HERMES_BASE_URL=https://inference-api.nousresearch.com/v1
HERMES_API_KEY=...
HERMES_MODEL=hermes-4-70b

# Infrastructure
REDIS_URL=redis://localhost:6379
LIGHTHOUSE_API_KEY=...    # Optional — enables real Filecoin CIDs in History

# Telegram bot (optional)
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

### Run

```bash
pnpm dev                                    # Full stack
pnpm --filter @flowvault/web dev            # Dashboard only
pnpm --filter agent-core dev                # Agent only
```

**Demo mode** (no wallet or API keys needed): Visit `/dashboard` — the agent seeds a realistic $841,760 demo treasury and starts simulating AI decisions automatically.

---

## Telegram Bot Commands

```
/status    — Agent health, uptime, total trades
/portfolio — Current allocation and drift
/pause     — Halt all autonomous trading
/resume    — Restart autonomous trading
/history   — Last 10 AI decisions
```

---

## Hackathon Submission

Built for the **Flow Future of Finance Hackathon**.

FlowVault demonstrates that the most important property of an autonomous agent managing real assets is not intelligence — it is **constraint**. A capable LLM decision layer operates under hard limits enforced at the contract level. Every action is logged to Filecoin. The AI writes the reason for every decision in plain English, permanently.

This is a production-quality fork of MentoGuard, a working autonomous agent deployed on Celo mainnet.
