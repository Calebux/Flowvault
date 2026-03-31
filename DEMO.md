# MentoGuard — Demo Script

**Duration:** 3–4 minutes
**Format:** Live walkthrough — dashboard + Celoscan + Filecoin gateway
**Core message:** The constraint is the innovation.

---

## Opening (20 seconds)

> "AI agents managing real money introduce a new class of risk — they act faster than you can react. The standard answer is off-chain guardrails: code checks, environment variables. These are breakable. MentoGuard's answer is different: put the rules on-chain, where the agent has to read them before every action. Let me show you what that looks like in practice."

---

## Step 1: Show the On-Chain Rules (45 seconds)

Open Celoscan → MentoGuardRules contract `0xba26522a9221a3de4234e8d5e8d52bd8216932c8`

> "This is the permission layer. Max swap $500. Max daily volume $2000. Token allowlist. Drift threshold. Emergency pause. These aren't environment variables — they're on-chain state. The agent reads this contract every tick before executing anything."

Point to the `readRules` function and the current values.

> "If I want to tighten the limits, I send one transaction. The agent picks it up within 60 seconds. No redeployment. No restart. The chain is the authority."

---

## Step 2: Show the Live Agent (45 seconds)

Open `https://mentoguard.vercel.app`

> "This is the dashboard. Live portfolio — cUSD, cEUR, CELO. Current drift from target allocation. The agent has been running autonomously and has executed 13 transactions on Celo mainnet."

Point to the activity feed.

> "Every entry here maps to a real transaction. The agent observed the portfolio, Hermes — the LLM — made a decision, delegation.ts checked the on-chain rules, and either executed or refused."

---

## Step 3: Show Real Transactions (40 seconds)

Open Celoscan → swap tx `0xe01b1a140bfd2c9727f41b0c068689d494a17bdc4fecb7ade66ef29f9c3f87a0`

> "Here's a live swap — CELO to cUSD, executed autonomously via Mento Broker. Real transaction, real value. Not a testnet demo."

Open Celoscan → Aave tx `0xeba6b17715d3185becdc816d924f60cb8ceecdcd38eda06b2c740b298f44408c`

> "And here the agent deployed idle cUSD into Aave V3 to earn yield. It decided the portfolio was balanced, so it put the stablecoins to work. All within the on-chain limits."

---

## Step 4: Show the Audit Trail (30 seconds)

Open `https://gateway.lighthouse.storage/ipfs/bafkreigmn2s7whz4knzpt2nsz3a74ybrvakoceqfbylqpgfzjwkngacjwa`

> "Every decision is logged to Filecoin — permanent, tamper-proof. This is the exact context the agent received, the decision it made, and the transaction hash. If the agent ever acts unexpectedly, you can pull this record and audit exactly what happened. Six of these CIDs are verified and in the README."

---

## Step 5: Show Identity (20 seconds)

Open `/dashboard/identity` on the dashboard.

> "Operators verify their identity via Self Protocol — ZK passport, no personal data exposed on-chain. Verified humans unlock higher limits. The agent reads verification status from the chain. Unverified? Conservative limits. Verified? Full limits. Trust is graduated and on-chain."

---

## Step 6: Show Telegram Control (20 seconds)

Open Telegram → [@MentoGuardBot](https://t.me/MentoGuardBot)

> "Natural language control. Send 'pause trading' — agent stops within 60 seconds. Send 'set target to 70% cUSD 30% CELO' — Hermes parses it, config updates. The agent is always listening."

---

## Close (20 seconds)

> "The thesis here is simple: the most important property of an autonomous agent managing real assets is not intelligence — it is constraint. MentoGuard demonstrates the pattern. A capable LLM operating under hard on-chain limits that neither the agent nor a malicious prompt can bypass. Every action audited. Every operator verified. This is running right now. These are real transactions."

---

## Backup: If asked about the LLM decision layer

> "Hermes receives the full portfolio context every tick — balances, drift, live FX rates, 24h CELO price momentum, Aave positions, on-chain rules. It uses function calling to pick from: execute swap, deposit to Aave, withdraw from Aave, send alert, or hold. It's not just 'drift exceeds threshold → swap' — it's market-aware. Strong CELO downtrend? It waits. Uptrend? It rebalances immediately."

## Backup: If asked why Celo

> "Celo is purpose-built for stablecoin DeFi — cUSD, cEUR, cREAL are native assets. Mento Protocol is the native stablecoin DEX with on-chain FX oracles. Aave V3 is deployed on Celo. The whole stack exists here and works on mainnet with real liquidity."

## Backup: If asked about security

> "Private key never leaves the server. All swaps validated against token allowlist before execution. On-chain rules are the hard floor — application code can add restrictions on top, but cannot remove the on-chain ones. Human approval required above threshold."

---

## Key Numbers to Know

- **13** confirmed mainnet transactions
- **$500** max single swap (on-chain enforced)
- **$2000** max daily volume (on-chain enforced)
- **60 seconds** — agent tick interval and rule update propagation
- **6** verified Filecoin CIDs
- **2** protocols integrated (Mento + Aave)
- **Chain ID 42220** — Celo Mainnet
