/**
 * yield-vaults.ts — Flow Yield Protocol integration
 *
 * This module handles depositing idle stablecoins into yield-bearing protocols
 * on Flow EVM. Currently targets ERC-4626 compatible yield vaults.
 *
 * NOTE: IncrementFi lending pools are Cadence-native (e.g. USDC pool at
 * 0x8334275bda13b2be on Flow Cadence), not EVM contracts. To interact with them
 * from Flow EVM, use the Cadence Owned Account (COA) bridge. The ERC-4626
 * interface below supports any EVM-native yield vault that launches on Flow.
 *
 * IncrementFi Cadence addresses (mainnet):
 *   SwapRouter:      0xa6850776a94e6551
 *   LendingPool USDC: 0x8334275bda13b2be
 *   LendingPool FLOW: 0x7492e2f9b4acea9a
 */

import {
  createWalletClient, createPublicClient, http,
  parseAbi, formatUnits, parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { flowMainnet } from "./monitor";

// ERC-4626 vault addresses on Flow EVM
// When EVM-native yield vaults launch on Flow, populate these with verified addresses
// For now, IncrementFi lending is accessed via Cadence (see header comment)
const YIELD_VAULT_USDC = "0x0000000000000000000000000000000000000001" as const; // awaiting EVM vault
const YIELD_VAULT_USDT = "0x0000000000000000000000000000000000000002" as const; // awaiting EVM vault

const TOKEN_TO_VAULT: Record<string, `0x${string}`> = {
  USDC: YIELD_VAULT_USDC,
  USDT: YIELD_VAULT_USDT,
};

// ERC-4626 vault ABI (standard yield vault interface)
const VAULT_ABI = parseAbi([
  "function deposit(uint256 assets, address receiver) returns (uint256 shares)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)",
  "function maxWithdraw(address owner) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
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

function getWalletClient() {
  const privateKey = process.env.FLOW_PRIVATE_KEY as `0x${string}`;
  if (!privateKey) throw new Error("FLOW_PRIVATE_KEY not set");
  const account = privateKeyToAccount(privateKey);
  return {
    account,
    client: createWalletClient({
      account,
      chain: flowMainnet,
      transport: http(process.env.FLOW_EVM_RPC_URL ?? "https://mainnet.evm.nodes.onflow.org"),
    }),
  };
}

/**
 * Returns the current yield position for a given token (in USD).
 * Uses vault share → asset conversion to compute USD value.
 */
export async function getYieldPosition(
  tokenAddress: `0x${string}`,
  owner: `0x${string}`,
  priceUSD: number
): Promise<number> {
  const token = Object.entries(TOKEN_TO_VAULT).find(
    ([, v]) => v.toLowerCase() !== tokenAddress.toLowerCase()
  );
  if (!token) return 0;

  const vaultAddress = TOKEN_TO_VAULT[token[0]];
  if (!vaultAddress || vaultAddress.startsWith("0x000000000000000000000000000000000000000")) {
    return 0; // vault not yet configured
  }

  try {
    const [shares, decimals] = await Promise.all([
      publicClient.readContract({ address: vaultAddress, abi: VAULT_ABI, functionName: "balanceOf", args: [owner] }) as Promise<bigint>,
      publicClient.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: "decimals" }).catch(() => 18) as Promise<number>,
    ]);
    if (shares === 0n) return 0;
    const assets = await publicClient.readContract({ address: vaultAddress, abi: VAULT_ABI, functionName: "convertToAssets", args: [shares] }) as bigint;
    return Number(formatUnits(assets, decimals)) * priceUSD;
  } catch {
    return 0;
  }
}

/** Deposit stablecoins into the yield vault */
export async function depositToYield(
  tokenAddress: `0x${string}`,
  amountUSD: number,
  tokenSymbol: string
): Promise<`0x${string}`> {
  const vaultAddress = TOKEN_TO_VAULT[tokenSymbol];
  if (!vaultAddress || vaultAddress.startsWith("0x000000000000000000000000000000000000000")) {
    throw new Error(`Yield vault not configured for ${tokenSymbol}`);
  }

  const { account, client: walletClient } = getWalletClient();

  const decimals = await publicClient.readContract({
    address: tokenAddress, abi: ERC20_ABI, functionName: "decimals",
  }).catch(() => 18) as number;

  const amount = parseUnits(amountUSD.toFixed(decimals > 6 ? 6 : decimals), decimals);

  // Approve vault to spend token
  const allowance = await publicClient.readContract({
    address: tokenAddress, abi: ERC20_ABI, functionName: "allowance",
    args: [account.address, vaultAddress],
  }) as bigint;

  if (allowance < amount) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const approveTx = await (walletClient as any).writeContract({
      address: tokenAddress, abi: ERC20_ABI, functionName: "approve",
      args: [vaultAddress, amount],
    }) as `0x${string}`;
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txHash = await (walletClient as any).writeContract({
    address: vaultAddress, abi: VAULT_ABI, functionName: "deposit",
    args: [amount, account.address],
  }) as `0x${string}`;

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") throw new Error(`Deposit reverted: ${txHash}`);
  console.log(`[yield] Deposited ${amountUSD} ${tokenSymbol} to vault: ${txHash}`);
  return txHash;
}

/** Withdraw stablecoins from the yield vault */
export async function withdrawFromYield(
  tokenAddress: `0x${string}`,
  amountUSD: number,
  tokenSymbol: string
): Promise<`0x${string}`> {
  const vaultAddress = TOKEN_TO_VAULT[tokenSymbol];
  if (!vaultAddress || vaultAddress.startsWith("0x000000000000000000000000000000000000000")) {
    throw new Error(`Yield vault not configured for ${tokenSymbol}`);
  }

  const { account, client: walletClient } = getWalletClient();

  const decimals = await publicClient.readContract({
    address: tokenAddress, abi: ERC20_ABI, functionName: "decimals",
  }).catch(() => 18) as number;

  const amount = parseUnits(amountUSD.toFixed(decimals > 6 ? 6 : decimals), decimals);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txHash = await (walletClient as any).writeContract({
    address: vaultAddress, abi: VAULT_ABI, functionName: "withdraw",
    args: [amount, account.address, account.address],
  }) as `0x${string}`;

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") throw new Error(`Withdraw reverted: ${txHash}`);
  console.log(`[yield] Withdrew ${amountUSD} ${tokenSymbol} from vault: ${txHash}`);
  return txHash;
}
