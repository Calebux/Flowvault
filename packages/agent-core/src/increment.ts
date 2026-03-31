/**
 * increment.ts — IncrementFi DEX execution on Flow EVM
 *
 * IncrementFi uses a Uniswap V2-compatible router interface.
 * All swaps route through the IncrementFi AMM on Flow EVM (Chain ID: 747).
 * Two-hop fallback: tokenIn → WFLOW → tokenOut if direct pair unavailable.
 *
 * TODO: verify ABI against live IncrementFi router at INCREMENT_ROUTER_ADDRESS.
 * Source: https://docs.increment.fi
 */

import { createWalletClient, createPublicClient, http, parseAbi, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { FLOW_TOKENS, INCREMENT_ROUTER_ADDRESS, FLOW_EVM_CHAIN_ID } from "@flowvault/shared";
import { flowMainnet } from "./monitor";

const WFLOW_ADDRESS = FLOW_TOKENS.FLOW as `0x${string}`;

// IncrementFi router ABI — Uniswap V2-compatible
const ROUTER_ABI = parseAbi([
  "function getAmountsOut(uint256 amountIn, address[] calldata path) view returns (uint256[] amounts)",
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] amounts)",
]);

const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

const publicClient = createPublicClient({
  chain: flowMainnet,
  transport: http(process.env.FLOW_EVM_RPC_URL ?? "https://mainnet.evm.nodes.onflow.org"),
});

/** Ensure token allowance >= amount before attempting a swap */
async function approveIfNeeded(
  token: `0x${string}`,
  spender: `0x${string}`,
  amount: bigint,
  owner: `0x${string}`,
  walletClient: ReturnType<typeof createWalletClient>
): Promise<void> {
  const allowance = await publicClient.readContract({
    address: token, abi: ERC20_ABI, functionName: "allowance",
    args: [owner, spender],
  }) as bigint;

  if (allowance < amount) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- viem generic requires explicit cast
    const tx = await (walletClient as any).writeContract({
      address: token, abi: ERC20_ABI, functionName: "approve",
      args: [spender, amount],
    }) as `0x${string}`;
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    if (receipt.status === "reverted") throw new Error(`Approve reverted: ${tx}`);
    console.log(`[increment] Approved ${token}: ${tx}`);
  }
}

/** Get expected output for a given path */
async function getAmountsOut(path: `0x${string}`[], amountIn: bigint): Promise<bigint> {
  const amounts = await publicClient.readContract({
    address: INCREMENT_ROUTER_ADDRESS,
    abi: ROUTER_ABI,
    functionName: "getAmountsOut",
    args: [amountIn, path],
  }) as bigint[];
  return amounts[amounts.length - 1]!;
}

/** Execute swap along a given path, returns tx hash */
async function doSwap(
  path: `0x${string}`[],
  amountIn: bigint,
  minOut: bigint,
  to: `0x${string}`,
  walletClient: ReturnType<typeof createWalletClient>
): Promise<`0x${string}`> {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 5); // 5 min deadline

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- viem generic requires explicit cast
  const txHash = await (walletClient as any).writeContract({
    address: INCREMENT_ROUTER_ADDRESS,
    abi: ROUTER_ABI,
    functionName: "swapExactTokensForTokens",
    args: [amountIn, minOut, path, to, deadline],
  }) as `0x${string}`;

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") throw new Error(`Swap reverted: ${txHash}`);
  return txHash;
}

/**
 * Execute a token swap on IncrementFi.
 * Tries direct path first; falls back to two-hop via WFLOW.
 */
export async function executeIncrementSwap(
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  amountUSD: number
): Promise<`0x${string}`> {
  const privateKey = process.env.FLOW_PRIVATE_KEY as `0x${string}`;
  if (!privateKey) throw new Error("FLOW_PRIVATE_KEY not set");

  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: flowMainnet,
    transport: http(process.env.FLOW_EVM_RPC_URL ?? "https://mainnet.evm.nodes.onflow.org"),
  });

  // Get token decimals
  const decimals = await publicClient.readContract({
    address: tokenIn, abi: ERC20_ABI, functionName: "decimals",
  }).catch(() => 18) as number;

  const amountIn = parseUnits(amountUSD.toFixed(decimals > 6 ? 6 : decimals), decimals);
  const slippage = 995n; // 0.5% slippage tolerance

  // ── Attempt 1: direct path tokenIn → tokenOut ─────────────────────────────
  const directPath: `0x${string}`[] = [tokenIn, tokenOut];
  try {
    const amountOut = await getAmountsOut(directPath, amountIn);
    if (amountOut > 0n) {
      await approveIfNeeded(tokenIn, INCREMENT_ROUTER_ADDRESS, amountIn, account.address, walletClient);
      const txHash = await doSwap(directPath, amountIn, (amountOut * slippage) / 1000n, account.address, walletClient);
      console.log(`[increment] Direct swap confirmed: ${txHash} (${formatUnits(amountIn, decimals)} ${tokenIn} → ~${formatUnits(amountOut, 18)} ${tokenOut})`);
      return txHash;
    }
  } catch (err) {
    console.warn(`[increment] Direct path failed: ${(err as Error).message}`);
  }

  // ── Attempt 2: two-hop tokenIn → WFLOW → tokenOut ────────────────────────
  if (tokenIn === WFLOW_ADDRESS || tokenOut === WFLOW_ADDRESS) {
    throw new Error("No valid route — direct path failed and no two-hop available");
  }

  console.log(`[increment] Trying two-hop via WFLOW...`);
  const hopPath: `0x${string}`[] = [tokenIn, WFLOW_ADDRESS, tokenOut];
  const amountOut = await getAmountsOut(hopPath, amountIn);
  if (amountOut === 0n) {
    throw new Error("No liquidity on two-hop path");
  }

  await approveIfNeeded(tokenIn, INCREMENT_ROUTER_ADDRESS, amountIn, account.address, walletClient);
  const txHash = await doSwap(hopPath, amountIn, (amountOut * slippage) / 1000n, account.address, walletClient);
  console.log(`[increment] Two-hop swap confirmed: ${txHash}`);
  return txHash;
}

// Export chain ID for use by other modules
export { FLOW_EVM_CHAIN_ID };
