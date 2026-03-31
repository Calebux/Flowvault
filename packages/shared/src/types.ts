import type { Address } from "viem";

// ─── Token types ────────────────────────────────────────────────────────────

export type MentoToken = "cUSD" | "cEUR" | "cBRL" | "cREAL" | "CELO";

export interface TokenBalance {
  token: MentoToken;
  address: Address;
  balance: bigint;
  balanceUSD: number;
}

export interface Allocation {
  token: MentoToken;
  percentage: number; // 0–100
}

// ─── FX Rates ────────────────────────────────────────────────────────────────

export interface FXRates {
  cUSD: number;
  cEUR: number;
  cBRL: number;
  cREAL: number;
  CELO: number;
  updatedAt: number; // unix timestamp
}

// ─── Agent ───────────────────────────────────────────────────────────────────

export type AgentStatus = "active" | "paused" | "stopped" | "error";

export interface AgentState {
  status: AgentStatus;
  startedAt: number | null;
  lastTickAt: number | null;
  totalTrades: number;
  totalFeesUSD: number;
  uptime: number; // seconds
}

// ─── User Config ─────────────────────────────────────────────────────────────

export interface TargetAllocation {
  cUSD: number;
  cEUR: number;
  cBRL: number;
  cREAL: number;
  CELO: number;
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
  driftThreshold: number; // percentage, e.g. 5 means 5%
  rules: DelegationRules;
  selfVerified: boolean;
  ensName: string | null;
  telegramChatId: string | null;
}

// ─── Trade History ────────────────────────────────────────────────────────────

export interface Trade {
  id: string;
  timestamp: number;
  fromToken: MentoToken;
  toToken: MentoToken;
  fromAmount: string;
  toAmount: string;
  txHash: string;
  feesUSD: number;
  filecoinCid: string | null;
}

// ─── Agent Memory ─────────────────────────────────────────────────────────────

export type MemoryEntryType =
  | "tick"
  | "rebalance"
  | "alert"
  | "rule_change"
  | "identity_verify";

export interface AgentMemoryEntry {
  type: MemoryEntryType;
  timestamp: number;
  data: Record<string, unknown>;
  txHash?: string;
  cid?: string; // linked-list pointer to previous entry on Filecoin
}

// ─── Monitor ─────────────────────────────────────────────────────────────────

export interface DriftMap {
  cUSD: number;
  cEUR: number;
  cBRL: number;
  cREAL: number;
  CELO: number;
}

export interface TickResult {
  rates: FXRates;
  balances: TokenBalance[];
  currentAllocation: TargetAllocation;
  drift: DriftMap;
  shouldRebalance: boolean;
  tickAt: number;
}

// ─── SSE Events ───────────────────────────────────────────────────────────────

export type SSEEventType =
  | "tick"
  | "rebalance_start"
  | "rebalance_complete"
  | "alert"
  | "status_change";

export interface SSEEvent {
  type: SSEEventType;
  payload: Record<string, unknown>;
  timestamp: number;
}
