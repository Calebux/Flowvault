"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatUSD = formatUSD;
exports.computeDrift = computeDrift;
exports.exceedsThreshold = exceedsThreshold;
exports.formatUptime = formatUptime;
exports.shortAddress = shortAddress;
exports.sleep = sleep;
/** Format a USD value for display */
function formatUSD(amount, decimals = 2) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(amount);
}
/** Compute percentage drift between current and target allocation */
function computeDrift(current, target) {
    // Dynamic — works for any set of tokens in TargetAllocation
    return Object.fromEntries(Object.keys(target).map((token) => [
        token,
        (current[token] ?? 0) - (target[token] ?? 0),
    ]));
}
/** Returns true if any token exceeds the drift threshold */
function exceedsThreshold(drift, thresholdPct) {
    return Object.values(drift).some((d) => Math.abs(d) > thresholdPct);
}
/** Format seconds into human-readable uptime string */
function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (d > 0)
        parts.push(`${d}d`);
    if (h > 0)
        parts.push(`${h}h`);
    parts.push(`${m}m`);
    return parts.join(" ");
}
/** Truncate an Ethereum address for display */
function shortAddress(address) {
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
/** Sleep for N milliseconds */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
