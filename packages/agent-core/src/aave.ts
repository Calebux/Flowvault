import {
  createWalletClient, createPublicClient, http,
  parseAbi, formatUnits, parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

export const AAVE_POOL = "0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402" as const;

const POOL_ABI = parseAbi([
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external",
  "function withdraw(address asset, uint256 amount, address to) returns (uint256)",
  // Returns tuple — we extract aTokenAddress at index [8]
  "function getReserveData(address asset) view returns (uint256,uint128,uint128,uint128,uint128,uint128,uint40,uint16,address,address,address,address,uint128,uint128,uint128)",
]);

const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);

const publicClient = createPublicClient({
  chain: celo,
  transport: http(process.env.CELO_RPC_URL ?? "https://forno.celo.org"),
});

/** Returns the aToken address for a given asset */
async function getATokenAddress(asset: `0x${string}`): Promise<`0x${string}`> {
  const data = await publicClient.readContract({
    address: AAVE_POOL,
    abi: POOL_ABI,
    functionName: "getReserveData",
    args: [asset],
  }) as unknown[];
  return data[8] as `0x${string}`;
}

/** Returns the aToken balance (= deposit position) in USD terms */
export async function getAavePosition(
  asset: `0x${string}`,
  account: `0x${string}`,
  usdPrice: number
): Promise<number> {
  try {
    const aToken = await getATokenAddress(asset);
    const balance = await publicClient.readContract({
      address: aToken,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account],
    }) as bigint;
    return Number(formatUnits(balance, 18)) * usdPrice;
  } catch {
    return 0;
  }
}

function getWalletClient() {
  const privateKey = process.env.CELO_PRIVATE_KEY as `0x${string}`;
  if (!privateKey) throw new Error("CELO_PRIVATE_KEY not set");
  const account = privateKeyToAccount(privateKey);
  return {
    account,
    walletClient: createWalletClient({
      account, chain: celo,
      transport: http(process.env.CELO_RPC_URL ?? "https://forno.celo.org"),
    }),
  };
}

/** Deposit `amountUSD` worth of `asset` into Aave to earn yield */
export async function depositToAave(
  asset: `0x${string}`,
  amountUSD: number,
  tokenSymbol: string
): Promise<string> {
  const { account, walletClient } = getWalletClient();
  const amountIn = parseUnits(amountUSD.toFixed(6), 18);

  // Approve pool
  const allowance = await publicClient.readContract({
    address: asset, abi: ERC20_ABI,
    functionName: "allowance", args: [account.address, AAVE_POOL],
  }) as bigint;
  if (allowance < amountIn) {
    const approveTx = await walletClient.writeContract({
      address: asset, abi: ERC20_ABI,
      functionName: "approve", args: [AAVE_POOL, amountIn],
    });
    const r = await publicClient.waitForTransactionReceipt({ hash: approveTx });
    if (r.status === "reverted") throw new Error(`Approve reverted: ${approveTx}`);
    console.log(`[aave] Approved ${tokenSymbol}: ${approveTx}`);
  }

  // Supply
  const txHash = await walletClient.writeContract({
    address: AAVE_POOL, abi: POOL_ABI,
    functionName: "supply",
    args: [asset, amountIn, account.address, 0],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") throw new Error(`Supply reverted: ${txHash}`);

  console.log(`[aave] Deposited $${amountUSD.toFixed(2)} ${tokenSymbol}: ${txHash}`);
  return txHash;
}

/** Withdraw `amountUSD` worth of `asset` from Aave back to wallet */
export async function withdrawFromAave(
  asset: `0x${string}`,
  amountUSD: number,
  tokenSymbol: string
): Promise<string> {
  const { account, walletClient } = getWalletClient();
  const amountIn = parseUnits(amountUSD.toFixed(6), 18);

  const txHash = await walletClient.writeContract({
    address: AAVE_POOL, abi: POOL_ABI,
    functionName: "withdraw",
    args: [asset, amountIn, account.address],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") throw new Error(`Withdraw reverted: ${txHash}`);

  console.log(`[aave] Withdrew $${amountUSD.toFixed(2)} ${tokenSymbol}: ${txHash}`);
  return txHash;
}
