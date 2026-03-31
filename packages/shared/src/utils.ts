import type { DriftMap, TargetAllocation } from "./types";

/** Format a USD value for display */
export function formatUSD(amount: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/** Compute percentage drift between current and target allocation */
export function computeDrift(
  current: TargetAllocation,
  target: TargetAllocation
): DriftMap {
  // Dynamic — works for any set of tokens in TargetAllocation
  return Object.fromEntries(
    (Object.keys(target) as (keyof TargetAllocation)[]).map((token) => [
      token,
      (current[token] ?? 0) - (target[token] ?? 0),
    ])
  ) as unknown as DriftMap;
}

/** Returns true if any token exceeds the drift threshold */
export function exceedsThreshold(
  drift: DriftMap,
  thresholdPct: number
): boolean {
  return Object.values(drift).some((d) => Math.abs(d) > thresholdPct);
}

/** Format seconds into human-readable uptime string */
export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

/** Truncate an Ethereum address for display */
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Sleep for N milliseconds */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
