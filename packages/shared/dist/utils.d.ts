import type { DriftMap, TargetAllocation } from "./types";
/** Format a USD value for display */
export declare function formatUSD(amount: number, decimals?: number): string;
/** Compute percentage drift between current and target allocation */
export declare function computeDrift(current: TargetAllocation, target: TargetAllocation): DriftMap;
/** Returns true if any token exceeds the drift threshold */
export declare function exceedsThreshold(drift: DriftMap, thresholdPct: number): boolean;
/** Format seconds into human-readable uptime string */
export declare function formatUptime(seconds: number): string;
/** Truncate an Ethereum address for display */
export declare function shortAddress(address: string): string;
/** Sleep for N milliseconds */
export declare function sleep(ms: number): Promise<void>;
