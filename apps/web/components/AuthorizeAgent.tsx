"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAccount, useSignTypedData } from "wagmi";
import { DEFAULT_DELEGATION_RULES, DEFAULT_DRIFT_THRESHOLD, DEFAULT_TARGET_ALLOCATION } from "@mentoguard/shared";

interface Props {
  ensName: string | null;
  onAuthorized: () => void;
}

const DELEGATION_DOMAIN = {
  name: "MentoGuard",
  version: "1",
  chainId: 42220, // Celo mainnet
} as const;

const DELEGATION_TYPES = {
  AgentDelegation: [
    { name: "delegate", type: "address" },
    { name: "maxSwapAmountUSD", type: "uint256" },
    { name: "maxDailyVolumeUSD", type: "uint256" },
    { name: "driftThreshold", type: "uint256" },
    { name: "timestamp", type: "uint256" },
  ],
} as const;

export function AuthorizeAgent({ ensName, onAuthorized }: Props) {
  const { address, isConnected } = useAccount();
  const [state, setState] = useState<"idle" | "signing" | "saving" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const { signTypedData } = useSignTypedData({
    mutation: {
      onSuccess: async (signature) => {
        setState("saving");
        try {
          const res = await fetch("/api/authorize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              smartAccount: address,
              signature,
              ensName,
              targetAllocation: DEFAULT_TARGET_ALLOCATION,
              driftThreshold: DEFAULT_DRIFT_THRESHOLD,
              rules: DEFAULT_DELEGATION_RULES,
            }),
          });
          if (!res.ok) throw new Error("Failed to save authorization");
          setState("done");
          setTimeout(onAuthorized, 800);
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : "Save failed");
          setState("error");
        }
      },
      onError: (err) => {
        setErrorMsg(err.message ?? "Signing cancelled");
        setState("error");
      },
    },
  });

  const handleSign = () => {
    if (!address) return;
    setState("signing");
    signTypedData({
      domain: DELEGATION_DOMAIN,
      types: DELEGATION_TYPES,
      primaryType: "AgentDelegation",
      message: {
        delegate: (process.env.NEXT_PUBLIC_AGENT_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
        maxSwapAmountUSD: BigInt(DEFAULT_DELEGATION_RULES.maxSwapAmountUSD),
        maxDailyVolumeUSD: BigInt(DEFAULT_DELEGATION_RULES.maxDailyVolumeUSD),
        driftThreshold: BigInt(DEFAULT_DRIFT_THRESHOLD),
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
      },
    });
  };

  if (!isConnected) {
    return (
      <div className="rounded-xl bg-surface border border-border p-6 text-center space-y-2">
        <p className="text-text-secondary text-sm">Connect your wallet first to authorize the agent.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface border border-border p-6 space-y-4">
      <h2 className="font-semibold text-lg">Authorize the Agent</h2>
      <p className="text-text-secondary text-sm">
        Sign a delegation that gives the agent permission to execute swaps within your configured rules. No gas required — it&apos;s an off-chain signature.
      </p>

      <div className="bg-background rounded-lg p-3 text-xs font-mono text-text-secondary space-y-1">
        <p>wallet: <span className="text-text-primary">{address?.slice(0, 10)}…{address?.slice(-8)}</span></p>
        <p>max swap: <span className="text-text-primary">${DEFAULT_DELEGATION_RULES.maxSwapAmountUSD}</span></p>
        <p>max daily: <span className="text-text-primary">${DEFAULT_DELEGATION_RULES.maxDailyVolumeUSD}</span></p>
        <p>drift threshold: <span className="text-text-primary">{DEFAULT_DRIFT_THRESHOLD}%</span></p>
      </div>

      {state === "idle" && (
        <button
          onClick={handleSign}
          className="w-full py-3 rounded-xl bg-accent-primary text-background font-semibold hover:opacity-90"
        >
          Sign Delegation
        </button>
      )}

      {(state === "signing" || state === "saving") && (
        <div className="text-center py-2 space-y-2">
          <motion.div
            className="w-8 h-8 mx-auto border-4 border-accent-primary border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
          />
          <p className="text-sm text-text-secondary">
            {state === "signing" ? "Check MetaMask…" : "Saving authorization…"}
          </p>
        </div>
      )}

      {state === "done" && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center py-2"
        >
          <p className="text-3xl">✅</p>
          <p className="mt-1 font-semibold text-accent-primary">Agent Authorized</p>
        </motion.div>
      )}

      {state === "error" && (
        <div className="space-y-3">
          <p className="text-sm text-red-500">{errorMsg}</p>
          <button
            onClick={() => setState("idle")}
            className="w-full py-2 rounded-xl border border-border text-sm hover:opacity-80"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
