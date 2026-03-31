/**
 * flow.ts — wagmi / viem chain configuration for Flow EVM
 *
 * Flow EVM is an EVM-compatible execution layer embedded in the Flow blockchain.
 * Chain ID: 747 (mainnet) | 545 (testnet)
 * Explorer: https://evm.flowscan.io
 */

import { defineChain, http } from "viem";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

// ─── Flow EVM chain definitions ───────────────────────────────────────────────

export const flowMainnet = defineChain({
  id: 747,
  name: "Flow EVM",
  nativeCurrency: { name: "Flow", symbol: "FLOW", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_FLOW_EVM_RPC_URL ?? "https://mainnet.evm.nodes.onflow.org"],
    },
  },
  blockExplorers: {
    default: { name: "FlowScan EVM", url: "https://evm.flowscan.io" },
  },
});

export const flowTestnet = defineChain({
  id: 545,
  name: "Flow EVM Testnet",
  nativeCurrency: { name: "Flow", symbol: "FLOW", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://testnet.evm.nodes.onflow.org"],
    },
  },
  blockExplorers: {
    default: { name: "FlowScan EVM Testnet", url: "https://evm-testnet.flowscan.io" },
  },
  testnet: true,
});

// ─── wagmi config ────────────────────────────────────────────────────────────

export const wagmiConfig = getDefaultConfig({
  appName: "FlowVault",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "flowvault-dev",
  chains: [flowMainnet, flowTestnet],
  transports: {
    [flowMainnet.id]: http(
      process.env.NEXT_PUBLIC_FLOW_EVM_RPC_URL ?? "https://mainnet.evm.nodes.onflow.org"
    ),
    [flowTestnet.id]: http("https://testnet.evm.nodes.onflow.org"),
  },
  ssr: true,
});

// ─── Explorer link helpers ────────────────────────────────────────────────────

export function flowscanTxUrl(txHash: string, testnet = false): string {
  const base = testnet
    ? "https://evm-testnet.flowscan.io"
    : "https://evm.flowscan.io";
  return `${base}/tx/${txHash}`;
}

export function flowscanAddressUrl(address: string, testnet = false): string {
  const base = testnet
    ? "https://evm-testnet.flowscan.io"
    : "https://evm.flowscan.io";
  return `${base}/address/${address}`;
}
