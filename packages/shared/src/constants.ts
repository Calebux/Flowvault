import type { Address } from "viem";

// ─── Chain IDs ───────────────────────────────────────────────────────────────
export const CELO_CHAIN_ID = 42220;
export const CELO_ALFAJORES_CHAIN_ID = 44787;

// ─── Mento Token Addresses (Celo Mainnet) ────────────────────────────────────
export const MENTO_TOKENS: Record<string, Address> = {
  cUSD: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  cEUR: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
  cBRL: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787",
  cREAL: "0xE6774B619A7B40e3D2A6a3e7a2B4E58E3F37f18d",
  // Wrapped CELO (ERC-20 representation of native CELO)
  CELO: "0x471EcE3750Da237f93B8E339c536989b8978a438",
};

// ─── Mento Broker (swap router) ──────────────────────────────────────────────
export const MENTO_BROKER_ADDRESS: Address =
  "0x777A8255cA72412f0d706dc03C9D1987306B4CaD";

// ─── Uniswap on Celo ─────────────────────────────────────────────────────────
export const UNISWAP_V3_ROUTER_CELO: Address =
  "0x5615CDAb10dc425a742d643d949a7F474C01abc4";

// ─── ENS ─────────────────────────────────────────────────────────────────────
export const ENS_REGISTRY_ADDRESS: Address =
  "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

// ─── Agent Defaults ───────────────────────────────────────────────────────────
export const DEFAULT_DRIFT_THRESHOLD = 5; // 5%
export const DEFAULT_TARGET_ALLOCATION = {
  cUSD: 45,
  cEUR: 10,
  cBRL: 0,
  cREAL: 0,
  CELO: 45,
};

export const DEFAULT_DELEGATION_RULES = {
  maxSwapAmountUSD: 500,
  maxDailyVolumeUSD: 2000,
  allowedTokens: Object.values(MENTO_TOKENS),
  allowedDexes: [UNISWAP_V3_ROUTER_CELO],
  timeWindow: { startHour: 0, endHour: 24 },
  requireHumanApprovalAbove: 1000,
};

// ─── Monitor ─────────────────────────────────────────────────────────────────
export const MONITOR_INTERVAL_SECONDS = 60;

// ─── Filecoin ─────────────────────────────────────────────────────────────────
export const FILECOIN_GATEWAY = "https://gateway.lighthouse.storage";
