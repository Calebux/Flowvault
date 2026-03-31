"use client";

import { useState } from "react";
import { SelfVerifyButton } from "@/components/SelfVerifyButton";
import { ENSSetup } from "@/components/ENSSetup";
import { AuthorizeAgent } from "@/components/AuthorizeAgent";

type Step = "self" | "ens" | "authorize" | "done";

export default function IdentityPage() {
  const [step, setStep] = useState<Step>("self");
  const [selfVerified, setSelfVerified] = useState(false);
  const [ensName, setEnsName] = useState<string | null>(null);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agent Identity</h1>
        <p className="mt-1 text-text-secondary text-sm">
          Three steps to activate your autonomous agent.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6">
        {(["self", "ens", "authorize"] as Step[]).map((s, i) => {
          const labels: Record<string, string> = {
            self: "1. Verify Human",
            ens: "2. ENS Identity",
            authorize: "3. Authorize Agent",
          };
          const done =
            (s === "self" && selfVerified) ||
            (s === "ens" && !!ensName) ||
            (s === "authorize" && step === "done");
          const active = step === s;

          return (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  done
                    ? "bg-accent-primary text-background"
                    : active
                    ? "bg-surface border-2 border-accent-primary text-text-primary"
                    : "bg-surface border border-border text-text-secondary"
                }`}
              >
                {done ? "✓ " : ""}{labels[s]}
              </div>
              {i < 2 && <div className="w-6 h-px bg-border" />}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      {step === "self" && (
        <SelfVerifyButton
          onVerified={() => {
            setSelfVerified(true);
            setStep("ens");
          }}
        />
      )}

      {step === "ens" && (
        <ENSSetup
          onRegistered={(name) => {
            setEnsName(name);
            setStep("authorize");
          }}
        />
      )}

      {step === "authorize" && (
        <AuthorizeAgent
          ensName={ensName}
          onAuthorized={() => setStep("done")}
        />
      )}

      {step === "done" && (
        <div className="rounded-xl bg-surface border border-accent-primary/30 p-6 text-center space-y-2">
          <p className="text-3xl">✅</p>
          <p className="font-semibold text-lg text-accent-primary">Agent Active</p>
          <p className="text-text-secondary text-sm">
            ENS: <span className="font-mono">{ensName}</span>
          </p>
          <p className="text-text-secondary text-sm">Self-verified human operator confirmed.</p>
        </div>
      )}
    </div>
  );
}
