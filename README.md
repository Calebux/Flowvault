# FlowVault 🏦

**AI-Powered DAO Treasury Manager on Flow**

An autonomous AI agent that manages DAO treasuries on Flow — continuously rebalancing, earning yield on idle capital, and protecting runway for upcoming expenses. Every decision is logged on-chain with plain-English reasoning.


---

## The Problem

DAOs collectively hold billions in treasury assets. Most sit idle in multi-sigs, managed manually, earning nothing, with no audit trail for decisions. Rebalancing happens quarterly at best — via governance votes, not market signals.

## The Solution

FlowVault deploys an AI agent (Hermes 4 70B with tool calling) that:

- **Continuously rebalances** to a target allocation within user-defined guardrails
- **Earns yield** on idle stablecoins automatically (IncrementFi lending vaults)
- **Protects runway** by ring-fencing stablecoins for upcoming DAO expenses
- **Logs every decision on-chain** with plain-English reasoning as Flow events
- **Enforces rules via Cadence contracts** — not backend code, not `require()` statements

```
AI decides what to do → Cadence contract verifies it's allowed → Agent executes (or refuses)
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
│  │  index.ts — Observe → Decide → Act loop (node-cron 60s)  │   │
│  └──────────────────────────────────────────────────────────┘   │
│         │              │               │              │          │
│         ▼              ▼               ▼              ▼          │
│   monitor.ts      llm.ts          executor.ts    memory.ts      │
│   (Pyth prices)   (Hermes 4 70B   (IncrementFi   (Filecoin      │
│   (Flow EVM)       tool calling)   DEX + rules)   Lighthouse)   │
│                                        │                         │
│                                   delegation.ts                  │
│                                   (reads Flow contract)          │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    FLOW EVM MAINNET (Chain ID: 747)               │
│                                                                  │
│  DelegationRules.cdc    TreasuryAccount.cdc    ExpenseReserve.cdc│
│  (6 onchain guardrails) (Flow smart account)   (DAO runway lock) │
│                                                                  │
│  IncrementFi Router     Pyth Oracle            DAOMultiSig.cdc   │
│  (DEX execution)        (Price feeds)          (2-of-3 approval) │
└──────────────────────────────────────────────────────────────────┘
```

---

## Monorepo Structure

```
flowvault/
├── apps/
│   ├── web/              # Next.js dashboard (Vercel)
│   └── telegram/         # Telegraf bot
├── packages/
│   ├── agent-core/       # AI agent loop, LLM, execution
│   │   └── src/
│   │       ├── index.ts        # Main cron loop (60s)
│   │       ├── monitor.ts      # Pyth prices, Flow EVM balances
│   │       ├── llm.ts          # Hermes 4 70B function calling (6 tools)
│   │       ├── executor.ts     # Swap orchestration
│   │       ├── increment.ts    # IncrementFi DEX integration
│   │       ├── yield-vaults.ts # ERC-4626 yield vault deposit/withdraw
│   │       ├── strategy.ts     # Rebalance calculation
│   │       ├── delegation.ts   # On-chain rule validation
│   │       └── memory.ts       # Redis + Filecoin logging
│   ├── shared/           # Types, constants, utilities
│   └── contracts/
│       ├── src/                # Solidity (EVM-compatible)
│       ├── cadence/            # Cadence contracts (Flow-native)
│       │   ├── DelegationRules.cdc
│       │   ├── TreasuryAccount.cdc
│       │   ├── ExpenseReserve.cdc
│       │   ├── DAOMultiSig.cdc
│       │   └── scripts/       # Cadence query scripts
│       └── flow.json          # Deployment config
```

---

## Technologies

| Technology | Role |
|---|---|
| **DelegationRules.cdc (Cadence)** | On-chain guardrails — 6 rules enforced by Flow type system |
| **TreasuryAccount.cdc** | Smart account with AgentDecision event log |
| **ExpenseReserve.cdc** | Ring-fences stablecoins for DAO expenses |
| **DAOMultiSig.cdc** | 2-of-3 approval for large rebalances |
| **Self Protocol** | ZK passport verification — graduated trust |
| **Filecoin / Lighthouse** | Immutable audit trail — every decision permanently logged |
| **IncrementFi** | DEX swaps on Flow EVM |
| **Pyth Network** | On-chain price oracle (FLOW, USDC, USDT, stFLOW) |
| **NousResearch Hermes-4-70B** | LLM decision engine — structured tool calling |
| **Flow EVM** | All execution — Chain ID 747 |
| **Redis** | Shared state between agent, dashboard, Telegram |
| **Next.js 15** | Dashboard — portfolio, treasury, activity feed |
| **viem** | On-chain reads and writes |

---

## AI Tools (6 Functions)

The AI agent can call one of 6 tools each tick:

| Tool | Action |
|---|---|
| `execute_swap` | Rebalance: sell overweight token, buy underweight |
| `send_alert` | Warn DAO admin without acting |
| `deposit_to_yield` | Deploy idle stablecoins to IncrementFi vaults |
| `withdraw_from_yield` | Pull tokens back before a swap |
| `reserve_expense` | Ring-fence runway for upcoming DAO payments |
| `hold` | Take no action, log the reason |

---

## Running Locally

### Prerequisites
- Node.js >= 20, pnpm >= 9
- A Flow wallet with private key
- Redis instance
- NousResearch API key (Hermes)

### Setup

```bash
git clone <repo-url>
cd flowvault
pnpm install
```

Copy `.env.example` to `.env`:

```env
FLOW_PRIVATE_KEY=0x...
FLOW_SMART_ACCOUNT_ADDRESS=0x...
FLOW_EVM_RPC_URL=https://mainnet.evm.nodes.onflow.org
HERMES_BASE_URL=https://inference-api.nousresearch.com/v1
HERMES_API_KEY=...
HERMES_MODEL=hermes-4-70b
REDIS_URL=redis://localhost:6379
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
LIGHTHOUSE_API_KEY=...
```

### Run

```bash
pnpm dev                                    # Full stack
pnpm --filter @flowvault/web dev            # Dashboard only
pnpm --filter agent-core dev                # Agent only
flow project deploy --network testnet       # Deploy Cadence contracts
```

---

## Telegram Bot Commands

```
/status    — Agent health, uptime, total trades
/portfolio — Current allocation and drift
/pause     — Halt all autonomous trading
/resume    — Restart autonomous trading
/history   — Last 10 swaps
```

---

## Hackathon Submission

Built for the **Flow Future of Finance Hackathon**.

FlowVault demonstrates that the most important property of an autonomous agent managing real assets is not intelligence — it is constraint. A capable LLM decision layer operates under hard on-chain limits enforced by Cadence's resource-oriented type system. Every action is audited to Filecoin. Every operator is verified via Self Protocol.

This is a production-quality fork of MentoGuard, a working autonomous agent deployed on Celo mainnet with 13+ confirmed transactions.
