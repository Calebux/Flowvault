import type { Address } from "viem";
export type FlowToken = "FLOW" | "USDC" | "USDT" | "stFLOW";
export interface TokenBalance {
    token: FlowToken;
    address: Address;
    balance: bigint;
    balanceUSD: number;
}
export interface Allocation {
    token: FlowToken;
    percentage: number;
}
export interface FXRates {
    FLOW: number;
    USDC: number;
    USDT: number;
    stFLOW: number;
    updatedAt: number;
}
export type AgentStatus = "active" | "paused" | "stopped" | "error";
export interface AgentState {
    status: AgentStatus;
    startedAt: number | null;
    lastTickAt: number | null;
    totalTrades: number;
    totalFeesUSD: number;
    uptime: number;
}
export interface TargetAllocation {
    FLOW: number;
    USDC: number;
    USDT: number;
    stFLOW: number;
}
export interface DelegationRules {
    maxSwapAmountUSD: number;
    maxDailyVolumeUSD: number;
    allowedTokens: Address[];
    allowedDexes: Address[];
    timeWindow: {
        startHour: number;
        endHour: number;
    };
    requireHumanApprovalAbove: number;
}
export interface UserConfig {
    smartAccount: Address;
    targetAllocation: TargetAllocation;
    driftThreshold: number;
    rules: DelegationRules;
    selfVerified: boolean;
    ensName: string | null;
    telegramChatId: string | null;
    daoConfig?: DAOConfig;
}
export interface ExpenseEntry {
    description: string;
    amountUSD: number;
    token: FlowToken;
    dueDate: number;
}
export interface DAOConfig {
    daoName: string;
    expenseSchedule: ExpenseEntry[];
    multiSigSigners: Address[];
    multiSigThreshold: number;
}
export interface Trade {
    id: string;
    timestamp: number;
    fromToken: FlowToken;
    toToken: FlowToken;
    fromAmount: string;
    toAmount: string;
    txHash: string;
    feesUSD: number;
    filecoinCid: string | null;
}
export type MemoryEntryType = "tick" | "rebalance" | "alert" | "rule_change" | "identity_verify";
export interface AgentMemoryEntry {
    type: MemoryEntryType;
    timestamp: number;
    data: Record<string, unknown>;
    txHash?: string;
    cid?: string;
}
export interface DriftMap {
    FLOW: number;
    USDC: number;
    USDT: number;
    stFLOW: number;
}
export interface TickResult {
    rates: FXRates;
    balances: TokenBalance[];
    currentAllocation: TargetAllocation;
    drift: DriftMap;
    shouldRebalance: boolean;
    tickAt: number;
}
export type SSEEventType = "tick" | "rebalance_start" | "rebalance_complete" | "alert" | "status_change";
export interface SSEEvent {
    type: SSEEventType;
    payload: Record<string, unknown>;
    timestamp: number;
}
