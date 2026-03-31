# FlowVault — Demo Script

**Duration:** 4 minutes
**Format:** Live walkthrough — dashboard + FlowScan + Filecoin gateway
**Core message:** AI-powered DAO treasury management with on-chain guardrails.

---

## Opening (30 seconds)

> "DAOs hold billions in treasury assets. Most sit idle. Most are managed manually. Most have no audit trail. FlowVault changes all three — an AI agent that continuously rebalances, earns yield, protects runway, and writes every decision on-chain in plain English."

---

## Step 1: Show the Dashboard (45 seconds)

Open `/dashboard`

> "This is the live dashboard. Portfolio donut — FLOW, USDC, USDT, stFLOW. Current allocation vs target. Look at the activity feed — that text: 'Rebalanced FLOW to USDC because 30-day volatility hit 2.3x threshold and Q2 payroll reserve requires $45,000 stable by April 30' — was written by the AI and emitted as a Flow event. It's permanently on-chain."

---

## Step 2: Show Treasury Management (30 seconds)

Open `/dashboard/treasury`

> "This is the DAO Treasury view. Upcoming expenses — payroll, grants, audit retainers. The ring-fenced reserve amount. Before any rebalance, the agent checks this. It will never rebalance in a way that puts payroll at risk."

---

## Step 3: Show the On-Chain Rules (30 seconds)

Open `/dashboard/rules`

> "These delegation rules are enforced by the Cadence contract on Flow — not backend code. Max swap $500. Daily volume cap $2,000. Token allowlist. Time windows. The type system enforces them. Set max swap to $100 — confirmed on-chain within 60 seconds."

---

## Step 4: Trigger a Live Tick (60 seconds)

Run in terminal: `pnpm --filter agent-core run tick:manual`

Watch in dashboard:
- Pyth prices fetched
- Balances read via Flow EVM
- Drift computed
- Hermes called — reasoning text appears
- If drift exceeded: IncrementFi swap executes — tx hash links to flowscan.io
- Filecoin CID logged

> "Watch the full loop. Observe. Decide. Act. Every step logged."

---

## Step 5: Show Rule Enforcement (30 seconds)

Try to trigger a swap above the $100 rule.

> "The contract rejected this transaction. Not our server — the Flow VM. The type system refused to commit it."

---

## Step 6: Show the Audit Trail (30 seconds)

Click any trade in history → opens Lighthouse gateway → shows full JSON record.

> "Every decision. Permanent. Auditable. Nobody can edit this. The AI's reasoning, the transaction hash, the market context — all on Filecoin."

---

## Step 7: Show Telegram (20 seconds)

Show live notification from the trade.

> "Your DAO treasurer gets this in real time — the AI's reasoning and the transaction hash, on their phone."

---

## Close (15 seconds)

> "FlowVault: continuous rebalancing, yield on idle capital, runway protection, every decision on-chain. Not a demo — a production-quality system running on Flow."

---

## Key Numbers

- **6** AI tools (swap, alert, yield deposit, yield withdraw, reserve expense, hold)
- **4** Cadence contracts (DelegationRules, TreasuryAccount, ExpenseReserve, DAOMultiSig)
- **60 seconds** — agent tick interval
- **$500** max single swap (on-chain enforced)
- **Chain ID 747** — Flow EVM Mainnet
