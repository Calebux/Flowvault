import { createWalletClient, createPublicClient, http, parseAbi, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

const BROKER_ADDRESS = "0x777A8255cA72412f0d706dc03C9D1987306B4CaD" as const;
const CELO_TOKEN = "0x471EcE3750Da237f93B8E339c536989b8978a438" as const;

const BROKER_ABI = parseAbi([
  "function getAmountOut(address exchangeProvider, bytes32 exchangeId, address tokenIn, address tokenOut, uint256 amountIn) view returns (uint256)",
  "function swapIn(address exchangeProvider, bytes32 exchangeId, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut) returns (uint256)",
  "function getExchangeProviders() view returns (address[])",
]);

const EXCHANGE_PROVIDER_ABI = parseAbi([
  "function getExchanges() view returns ((bytes32 exchangeId, address[] assets)[])",
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

/** Ensures allowance >= amount. Approve is done BEFORE oracle check to reduce timing gap. */
async function approveIfNeeded(
  token: `0x${string}`,
  spender: `0x${string}`,
  amount: bigint,
  owner: `0x${string}`,
  walletClient: ReturnType<typeof createWalletClient>
) {
  const allowance = await publicClient.readContract({
    address: token, abi: ERC20_ABI, functionName: "allowance",
    args: [owner, spender],
  }) as bigint;
  if (allowance < amount) {
    const tx = await walletClient.writeContract({
      address: token, abi: ERC20_ABI, functionName: "approve",
      args: [spender, amount],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    if (receipt.status === "reverted") throw new Error(`Approve reverted: ${tx}`);
    console.log(`[mento] Approved ${token}: ${tx}`);
  }
}

/** Returns first exchange with a live oracle quote, or throws. */
async function findWorkingExchange(
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  amountIn: bigint
): Promise<{ provider: `0x${string}`; exchangeId: `0x${string}`; amountOut: bigint }> {
  const providers = await publicClient.readContract({
    address: BROKER_ADDRESS, abi: BROKER_ABI,
    functionName: "getExchangeProviders",
  }) as `0x${string}`[];

  for (const provider of providers) {
    const exchanges = await publicClient.readContract({
      address: provider, abi: EXCHANGE_PROVIDER_ABI,
      functionName: "getExchanges",
    }) as { exchangeId: `0x${string}`; assets: `0x${string}`[] }[];

    for (const ex of exchanges) {
      const hasIn  = ex.assets.some(a => a.toLowerCase() === tokenIn.toLowerCase());
      const hasOut = ex.assets.some(a => a.toLowerCase() === tokenOut.toLowerCase());
      if (!hasIn || !hasOut) continue;
      try {
        const amountOut = await publicClient.readContract({
          address: BROKER_ADDRESS, abi: BROKER_ABI,
          functionName: "getAmountOut",
          args: [provider, ex.exchangeId, tokenIn, tokenOut, amountIn],
        }) as bigint;
        console.log(`[mento] Oracle OK: ${formatUnits(amountIn, 18)} in → ~${formatUnits(amountOut, 18)} out`);
        return { provider, exchangeId: ex.exchangeId, amountOut };
      } catch {
        console.warn(`[mento] Exchange ${ex.exchangeId} oracle stale, skipping`);
      }
    }
  }
  throw new Error(`no valid median — oracle stale for ${tokenIn} → ${tokenOut}`);
}

async function doSwap(
  provider: `0x${string}`,
  exchangeId: `0x${string}`,
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  amountIn: bigint,
  minOut: bigint,
  walletClient: ReturnType<typeof createWalletClient>
): Promise<string> {
  const txHash = await walletClient.writeContract({
    address: BROKER_ADDRESS, abi: BROKER_ABI, functionName: "swapIn",
    args: [provider, exchangeId, tokenIn, tokenOut, amountIn, minOut],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") throw new Error(`swapIn reverted: ${txHash}`);
  return txHash;
}

export async function executeMentoSwap(
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  amountUSD: number
): Promise<string> {
  const privateKey = process.env.CELO_PRIVATE_KEY as `0x${string}`;
  if (!privateKey) throw new Error("CELO_PRIVATE_KEY not set");

  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account, chain: celo,
    transport: http(process.env.CELO_RPC_URL ?? "https://forno.celo.org"),
  });

  const amountIn = parseUnits(amountUSD.toFixed(6), 18);

  // ── Attempt 1: direct swap ──────────────────────────────────────────────────
  // Approve FIRST (takes ~5s for block), then check oracle right before swapIn
  // to minimize the window between oracle check and swap execution.
  try {
    await approveIfNeeded(tokenIn, BROKER_ADDRESS, amountIn, account.address, walletClient);
    const { provider, exchangeId, amountOut } = await findWorkingExchange(tokenIn, tokenOut, amountIn);
    const txHash = await doSwap(provider, exchangeId, tokenIn, tokenOut, amountIn, (amountOut * 995n) / 1000n, walletClient);
    console.log(`[mento] Direct swap confirmed: ${txHash}`);
    return txHash;
  } catch (err) {
    console.warn(`[mento] Direct swap failed: ${(err as Error).message}`);
  }

  // ── Attempt 2: two-hop tokenIn → CELO → tokenOut ───────────────────────────
  if (tokenIn === CELO_TOKEN || tokenOut === CELO_TOKEN) {
    throw new Error("no valid median — oracle stale and no two-hop path available");
  }

  console.log(`[mento] Trying two-hop via CELO...`);

  // Approve tokenIn first, then check oracle
  await approveIfNeeded(tokenIn, BROKER_ADDRESS, amountIn, account.address, walletClient);
  const hop1 = await findWorkingExchange(tokenIn, CELO_TOKEN, amountIn);
  const tx1 = await doSwap(hop1.provider, hop1.exchangeId, tokenIn, CELO_TOKEN, amountIn, (hop1.amountOut * 995n) / 1000n, walletClient);
  console.log(`[mento] Hop 1 confirmed (→ CELO): ${tx1}`);

  const celoReceived = await publicClient.readContract({
    address: CELO_TOKEN, abi: ERC20_ABI,
    functionName: "balanceOf", args: [account.address],
  }) as bigint;
  console.log(`[mento] CELO balance after hop 1: ${formatUnits(celoReceived, 18)}`);

  // Approve CELO, then check hop-2 oracle
  await approveIfNeeded(CELO_TOKEN, BROKER_ADDRESS, celoReceived, account.address, walletClient);
  const hop2 = await findWorkingExchange(CELO_TOKEN, tokenOut, celoReceived);
  const tx2 = await doSwap(hop2.provider, hop2.exchangeId, CELO_TOKEN, tokenOut, celoReceived, (hop2.amountOut * 995n) / 1000n, walletClient);
  console.log(`[mento] Hop 2 confirmed (→ ${tokenOut}): ${tx2}`);
  return tx2;
}
