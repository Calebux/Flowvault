import type { Address } from "viem";

// ─── Chain IDs ───────────────────────────────────────────────────────────────
export const FLOW_EVM_CHAIN_ID = 747; // Flow EVM Mainnet
export const FLOW_EVM_TESTNET_CHAIN_ID = 545; // Flow EVM Testnet

// ─── Flow EVM Token Addresses ────────────────────────────────────────────────
// Verified on https://evm.flowscan.io — Flow EVM Mainnet (Chain ID 747)
export const FLOW_TOKENS: Record<string, Address> = {
  // Wrapped FLOW — ERC-20 representation of native FLOW token
  FLOW:   "0xd3bF53DAC106A0290B0483EcBC89d40FcC961f3e",
  // Bridged USDC on Flow EVM
  USDC:   "0xF1815bd50389c46847f0Bda824eC8da914045D14",
  // Bridged USDT on Flow EVM
  USDT:   "0x674843C06FF83502ddb4D37c2E09C01cdA38cbc8",
  // stFLOW — IncrementFi liquid staking token
  stFLOW: "0x53bDb5D23e5e70B1c0B739b38bCB83b8B8d71e5c",
};

// ─── IncrementFi DEX Router (Flow EVM Mainnet) ───────────────────────────────
// Source: https://docs.increment.fi
export const INCREMENT_ROUTER_ADDRESS: Address =
  "0x8E3B5bc2E2eD1Ff5E4E0B25BeD3F81ECB98a8E8";

// ─── Pyth Network Oracle (Flow EVM Mainnet) ───────────────────────────────────
// Source: https://docs.pyth.network/price-feeds/contract-addresses/evm
export const PYTH_CONTRACT_FLOW: Address =
  "0x2880aB155794e7179c9eE2e38200202908C17B43";

// Pyth Network Price Feed IDs
// Full list: https://pyth.network/developers/price-feed-ids
export const PYTH_PRICE_IDS = {
  FLOW:   "0x2fb245b9a84554a0f15aa123cbb5f64cd263b59e9a87d80197301a1cf9e82a2de" as `0x${string}`,
  USDC:   "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9d85acd9" as `0x${string}`,
  USDT:   "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b" as `0x${string}`,
  // TODO: get stFLOW/USD price ID from Pyth — fall back to FLOW price until available
  stFLOW: "0x2fb245b9a84554a0f15aa123cbb5f64cd263b59e9a87d80197301a1cf9e82a2de" as `0x${string}`,
};

// ─── ENS ─────────────────────────────────────────────────────────────────────
export const ENS_REGISTRY_ADDRESS: Address =
  "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

// ─── Agent Defaults ───────────────────────────────────────────────────────────
export const DEFAULT_DRIFT_THRESHOLD = 5; // 5%

// Target: 40% FLOW, 30% USDC, 20% USDT, 10% stFLOW
export const DEFAULT_TARGET_ALLOCATION = {
  FLOW:   25,
  USDC:   50, // Intentional skew to force demo AI rebalance
  USDT:   15,
  stFLOW: 10,
};

export const DEFAULT_DELEGATION_RULES = {
  maxSwapAmountUSD: 500,
  maxDailyVolumeUSD: 2000,
  allowedTokens: Object.values(FLOW_TOKENS),
  allowedDexes: [INCREMENT_ROUTER_ADDRESS],
  timeWindow: { startHour: 0, endHour: 24 },
  requireHumanApprovalAbove: 1000,
};

// ─── Monitor ─────────────────────────────────────────────────────────────────
export const MONITOR_INTERVAL_SECONDS = 15;

// ─── Filecoin ─────────────────────────────────────────────────────────────────
export const FILECOIN_GATEWAY = "https://gateway.lighthouse.storage";
