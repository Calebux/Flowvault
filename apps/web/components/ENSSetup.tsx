"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface Props {
  onRegistered: (name: string) => void;
}

export function ENSSetup({ onRegistered }: Props) {
  const [name, setName] = useState("flowvault");
  const [state, setState] = useState<"idle" | "registering" | "done">("idle");

  const handleRegister = () => {
    setState("registering");
    // In production: call ENS registration contract + set text records
    setTimeout(() => {
      setState("done");
      setTimeout(() => onRegistered(`${name}.agent.eth`), 800);
    }, 2000);
  };

  return (
    <div className="rounded-xl bg-surface border border-border p-6 space-y-4">
      <h2 className="font-semibold text-lg">Register ENS Identity</h2>
      <p className="text-text-secondary text-sm">
        Your agent gets a human-readable ENS name with capability metadata stored as text records.
      </p>

      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono"
          placeholder="flowvault"
        />
        <span className="text-text-secondary text-sm">.agent.eth</span>
      </div>

      <div className="bg-background rounded-lg p-3 text-xs font-mono text-text-secondary space-y-1">
        <p>description: Autonomous DAO treasury manager on Flow</p>
        <p>agent.capabilities: treasury-rebalancing,yield-deployment,expense-reserve,flow-evm</p>
        <p>agent.selfVerified: true</p>
      </div>

      {state === "idle" && (
        <button
          onClick={handleRegister}
          className="w-full py-3 rounded-xl bg-accent-primary text-background font-semibold hover:opacity-90"
        >
          Register {name}.agent.eth
        </button>
      )}

      {state === "registering" && (
        <div className="text-center py-2">
          <motion.div
            className="w-8 h-8 mx-auto border-4 border-accent-primary border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
          />
          <p className="mt-2 text-sm text-text-secondary">Registering ENS name...</p>
        </div>
      )}

      {state === "done" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-2"
        >
          <p className="text-2xl">🌐</p>
          <p className="font-semibold text-accent-primary">{name}.agent.eth registered!</p>
        </motion.div>
      )}
    </div>
  );
}
