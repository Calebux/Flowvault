import { createPublicClient, http, parseAbi } from "viem";
import { celo } from "viem/chains";
import type { DelegationRules } from "@mentoguard/shared";
import type { SwapInstruction } from "./strategy";

// MentoGuardRules contract — deployed on Celo mainnet
// Source: contracts/src/MentoGuardRules.sol
export const RULES_CONTRACT = "0xba26522a9221a3de4234e8d5e8d52bd8216932c8" as const;

const RULES_ABI = parseAbi([
  "function getRules() view returns (uint256 maxSwapAmountUSD, uint256 maxDailyVolumeUSD, uint8 driftThreshold, bool paused, uint256 updatedAt)",
]);

const publicClient = createPublicClient({
  chain: celo,
  transport: http(process.env.CELO_RPC_URL ?? "https://forno.celo.org"),
});

/** Fetch on-chain delegation rules. Falls back to provided rules if contract call fails. */
export async function fetchOnChainRules(fallback: DelegationRules): Promise<DelegationRules & { paused: boolean }> {
  try {
    const result = await publicClient.readContract({
      address: RULES_CONTRACT,
      abi: RULES_ABI,
      functionName: "getRules",
    }) as { maxSwapAmountUSD: bigint; maxDailyVolumeUSD: bigint; driftThreshold: number; paused: boolean; updatedAt: bigint };

    console.log(`[delegation] On-chain rules — maxSwap: $${Number(result.maxSwapAmountUSD) / 100} paused: ${result.paused}`);
    return {
      ...fallback,
      maxSwapAmountUSD: Number(result.maxSwapAmountUSD) / 100,
      maxDailyVolumeUSD: Number(result.maxDailyVolumeUSD) / 100,
      paused: result.paused,
    };
  } catch (err) {
    console.warn("[delegation] Could not read on-chain rules, using config fallback:", (err as Error).message);
    return { ...fallback, paused: false };
  }
}

/**
 * Validate a proposed swap against the user's delegation rules.
 * Throws if any rule is violated — enforced both on-chain (MentoGuardRules contract)
 * and off-chain here before the transaction is even attempted.
 */
export function validateDelegationRules(
  swap: SwapInstruction,
  rules: DelegationRules
): void {
  // 1. Max single swap amount
  if (swap.amountUSD > rules.maxSwapAmountUSD) {
    throw new Error(
      `Swap of $${swap.amountUSD.toFixed(2)} exceeds max single swap limit of $${rules.maxSwapAmountUSD}`
    );
  }

  // 2. Allowed tokens check
  const fromAllowed = rules.allowedTokens.includes(swap.fromAddress);
  const toAllowed = rules.allowedTokens.includes(swap.toAddress);
  if (!fromAllowed || !toAllowed) {
    throw new Error(
      `Token not in allowlist: ${!fromAllowed ? swap.fromToken : swap.toToken}`
    );
  }

  // 3. Time window check
  const hour = new Date().getUTCHours();
  if (hour < rules.timeWindow.startHour || hour >= rules.timeWindow.endHour) {
    throw new Error(
      `Outside operating hours: ${rules.timeWindow.startHour}–${rules.timeWindow.endHour} UTC (currently ${hour}:00 UTC)`
    );
  }

  // 4. Human approval required above threshold
  if (swap.amountUSD > rules.requireHumanApprovalAbove) {
    throw new Error(
      `Swap of $${swap.amountUSD.toFixed(2)} requires human approval (threshold: $${rules.requireHumanApprovalAbove})`
    );
  }
}

/**
 * Encode delegation rules as EIP-7710 caveat data.
 * Used when writing rules to the MetaMask Smart Account.
 */
export function encodeCaveats(rules: DelegationRules): `0x${string}` {
  // Placeholder — real implementation uses MetaMask Delegation Toolkit ABI encoding
  const encoded = JSON.stringify(rules);
  const hex = Buffer.from(encoded).toString("hex");
  return `0x${hex}`;
}
