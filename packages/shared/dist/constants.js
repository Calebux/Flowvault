"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FILECOIN_GATEWAY = exports.MONITOR_INTERVAL_SECONDS = exports.DEFAULT_DELEGATION_RULES = exports.DEFAULT_TARGET_ALLOCATION = exports.DEFAULT_DRIFT_THRESHOLD = exports.ENS_REGISTRY_ADDRESS = exports.PYTH_PRICE_IDS = exports.PYTH_CONTRACT_FLOW = exports.INCREMENT_ROUTER_ADDRESS = exports.FLOW_TOKENS = exports.FLOW_EVM_TESTNET_CHAIN_ID = exports.FLOW_EVM_CHAIN_ID = void 0;
// ─── Chain IDs ───────────────────────────────────────────────────────────────
exports.FLOW_EVM_CHAIN_ID = 747; // Flow EVM Mainnet
exports.FLOW_EVM_TESTNET_CHAIN_ID = 545; // Flow EVM Testnet
// ─── Flow EVM Token Addresses ────────────────────────────────────────────────
// Verified on https://evm.flowscan.io — Flow EVM Mainnet (Chain ID 747)
exports.FLOW_TOKENS = {
    // Wrapped FLOW — ERC-20 representation of native FLOW token
    FLOW: "0xd3bF53DAC106A0290B0483EcBC89d40FcC961f3e",
    // Bridged USDC on Flow EVM
    USDC: "0xF1815bd50389c46847f0Bda824eC8da914045D14",
    // Bridged USDT on Flow EVM
    USDT: "0x674843C06FF83502ddb4D37c2E09C01cdA38cbc8",
    // stFLOW — IncrementFi liquid staking token
    stFLOW: "0x53bDb5D23e5e70B1c0B739b38bCB83b8B8d71e5c",
};
// ─── IncrementFi DEX Router (Flow EVM Mainnet) ───────────────────────────────
// Source: https://docs.increment.fi
exports.INCREMENT_ROUTER_ADDRESS = "0x8E3B5bc2E2eD1Ff5E4E0B25BeD3F81ECB98a8E8";
// ─── Pyth Network Oracle (Flow EVM Mainnet) ───────────────────────────────────
// Source: https://docs.pyth.network/price-feeds/contract-addresses/evm
exports.PYTH_CONTRACT_FLOW = "0x2880aB155794e7179c9eE2e38200202908C17B43";
// Pyth Network Price Feed IDs
// Full list: https://pyth.network/developers/price-feed-ids
exports.PYTH_PRICE_IDS = {
    FLOW: "0x2fb245b9a84554a0f15aa123cbb5f64cd263b59e9a87d80197301a1cf9e82a2de",
    USDC: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9d85acd9",
    USDT: "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
    // TODO: get stFLOW/USD price ID from Pyth — fall back to FLOW price until available
    stFLOW: "0x2fb245b9a84554a0f15aa123cbb5f64cd263b59e9a87d80197301a1cf9e82a2de",
};
// ─── ENS ─────────────────────────────────────────────────────────────────────
exports.ENS_REGISTRY_ADDRESS = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
// ─── Agent Defaults ───────────────────────────────────────────────────────────
exports.DEFAULT_DRIFT_THRESHOLD = 5; // 5%
// Target: 40% FLOW, 30% USDC, 20% USDT, 10% stFLOW
exports.DEFAULT_TARGET_ALLOCATION = {
    FLOW: 25,
    USDC: 50, // Intentional skew to force demo AI rebalance
    USDT: 15,
    stFLOW: 10,
};
exports.DEFAULT_DELEGATION_RULES = {
    maxSwapAmountUSD: 500,
    maxDailyVolumeUSD: 2000,
    allowedTokens: Object.values(exports.FLOW_TOKENS),
    allowedDexes: [exports.INCREMENT_ROUTER_ADDRESS],
    timeWindow: { startHour: 0, endHour: 24 },
    requireHumanApprovalAbove: 1000,
};
// ─── Monitor ─────────────────────────────────────────────────────────────────
exports.MONITOR_INTERVAL_SECONDS = 15;
// ─── Filecoin ─────────────────────────────────────────────────────────────────
exports.FILECOIN_GATEWAY = "https://gateway.lighthouse.storage";
