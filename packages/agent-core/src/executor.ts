import type { SwapInstruction } from "./strategy";
import { validateDelegationRules } from "./delegation";
import type { DelegationRules } from "@mentoguard/shared";
import { logRebalance } from "./memory";
import { executeMentoSwap } from "./mento";

export async function executeSwap(
  swap: SwapInstruction,
  smartAccount: `0x${string}`,
  rules: DelegationRules
): Promise<string> {
  // 1. Validate against delegation rules (throws if violated)
  validateDelegationRules(swap, rules);

  // 2. Try Mento Broker (native Celo stablecoin DEX) with retries
  console.log(`[executor] Trying Mento Broker for ${swap.fromToken} → ${swap.toToken}`);
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const txHash = await executeMentoSwap(
        swap.fromAddress as `0x${string}`,
        swap.toAddress as `0x${string}`,
        swap.amountUSD
      );
      logRebalance({ swap, txHash, quote: null, timestamp: Date.now() }).catch(
        (err) => console.warn("[executor] Filecoin log failed:", err)
      );
      return txHash;
    } catch (err) {
      lastErr = err;
      const msg = (err as Error).message ?? "";
      console.warn(`[executor] Mento attempt ${attempt}/3 failed: ${msg}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 20_000));
    }
  }
  throw lastErr;
}
