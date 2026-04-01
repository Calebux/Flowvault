import type { Address } from "viem";
export declare const FLOW_EVM_CHAIN_ID = 747;
export declare const FLOW_EVM_TESTNET_CHAIN_ID = 545;
export declare const FLOW_TOKENS: Record<string, Address>;
export declare const INCREMENT_ROUTER_ADDRESS: Address;
export declare const PYTH_CONTRACT_FLOW: Address;
export declare const PYTH_PRICE_IDS: {
    FLOW: `0x${string}`;
    USDC: `0x${string}`;
    USDT: `0x${string}`;
    stFLOW: `0x${string}`;
};
export declare const ENS_REGISTRY_ADDRESS: Address;
export declare const DEFAULT_DRIFT_THRESHOLD = 5;
export declare const DEFAULT_TARGET_ALLOCATION: {
    FLOW: number;
    USDC: number;
    USDT: number;
    stFLOW: number;
};
export declare const DEFAULT_DELEGATION_RULES: {
    maxSwapAmountUSD: number;
    maxDailyVolumeUSD: number;
    allowedTokens: `0x${string}`[];
    allowedDexes: `0x${string}`[];
    timeWindow: {
        startHour: number;
        endHour: number;
    };
    requireHumanApprovalAbove: number;
};
export declare const MONITOR_INTERVAL_SECONDS = 15;
export declare const FILECOIN_GATEWAY = "https://gateway.lighthouse.storage";
