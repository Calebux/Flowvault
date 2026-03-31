"use client";

import { DelegationRuleForm } from "@/components/DelegationRuleForm";

export default function RulesPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Delegation Rules</h1>
        <p className="mt-1 text-text-secondary text-sm">
          These rules are enforced <strong className="text-text-primary">onchain</strong> via MetaMask Delegation Toolkit.
          The agent literally cannot exceed them.
        </p>
      </div>

      <DelegationRuleForm />
    </div>
  );
}
