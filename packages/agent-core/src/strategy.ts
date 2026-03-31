import type {
  DriftMap,
  TargetAllocation,
  MentoToken,
  FXRates,
} from "@mentoguard/shared";
import { MENTO_TOKENS } from "@mentoguard/shared";

export interface SwapInstruction {
  fromToken: MentoToken;
  toToken: MentoToken;
  fromAddress: `0x${string}`;
  toAddress: `0x${string}`;
  amountUSD: number;
  reason: string;
}

/**
 * Given drift and current portfolio value, compute the minimal set of swaps
 * needed to return to target allocation.
 */
export function computeRebalanceSwaps(
  drift: DriftMap,
  currentAllocation: TargetAllocation,
  totalPortfolioUSD: number
): SwapInstruction[] {
  const swaps: SwapInstruction[] = [];

  // Separate overweight (sell) and underweight (buy) tokens
  const overweight = (Object.entries(drift) as [MentoToken, number][])
    .filter(([, d]) => d > 0)
    .sort(([, a], [, b]) => b - a);

  const underweight = (Object.entries(drift) as [MentoToken, number][])
    .filter(([, d]) => d < 0)
    .sort(([, a], [, b]) => a - b);

  // Pair largest overweight with largest underweight
  let oi = 0;
  let ui = 0;

  while (oi < overweight.length && ui < underweight.length) {
    const [fromToken, fromDrift] = overweight[oi]!;
    const [toToken, toDrift] = underweight[ui]!;

    const amountUSD =
      Math.min(
        (fromDrift / 100) * totalPortfolioUSD,
        (Math.abs(toDrift) / 100) * totalPortfolioUSD
      );

    if (amountUSD > 0.01) {
      swaps.push({
        fromToken,
        toToken,
        fromAddress: MENTO_TOKENS[fromToken] as `0x${string}`,
        toAddress: MENTO_TOKENS[toToken] as `0x${string}`,
        amountUSD,
        reason: `Drift: ${fromToken} +${fromDrift.toFixed(1)}% → ${toToken} ${toDrift.toFixed(1)}%`,
      });
    }

    // Move pointers
    if (Math.abs(fromDrift) <= Math.abs(toDrift)) {
      oi++;
    } else {
      ui++;
    }
    if (Math.abs(fromDrift) === Math.abs(toDrift)) {
      oi++;
      ui++;
    }
  }

  return swaps;
}
