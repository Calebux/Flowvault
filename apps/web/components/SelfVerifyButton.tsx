"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { v4 as uuidv4 } from "uuid";
import { SelfQRcodeWrapper, SelfAppBuilder } from "@selfxyz/qrcode";

interface Props {
  onVerified: () => void;
}

export function SelfVerifyButton({ onVerified }: Props) {
  const [state, setState] = useState<"idle" | "scanning" | "done" | "error">("idle");
  const [selfApp, setSelfApp] = useState<ReturnType<SelfAppBuilder["build"]> | null>(null);

  const handleStart = () => {
    const app = new SelfAppBuilder({
      appName: "MentoGuard",
      scope: process.env.NEXT_PUBLIC_SELF_APP_SCOPE ?? "mentoguard",
      endpoint: process.env.NEXT_PUBLIC_SELF_VERIFICATION_ENDPOINT ?? "/api/self/verify",
      userId: uuidv4(),
      disclosures: {
        minimumAge: 18,
        ofac: true,
      },
    }).build();

    setSelfApp(app);
    setState("scanning");
  };

  const handleSuccess = () => {
    setState("done");
    setTimeout(onVerified, 800);
  };

  const handleError = (data: { error_code?: string; reason?: string }) => {
    console.error("[self-verify] Error:", data);
    setState("error");
  };

  return (
    <div className="rounded-xl bg-surface border border-border p-6 space-y-4">
      <h2 className="font-semibold text-lg">Verify Human Identity</h2>
      <p className="text-text-secondary text-sm">
        Scan the QR code with the <strong className="text-text-primary">Self app</strong> on your
        phone. A ZK proof confirms you&apos;re a real human — no personal data is stored.
      </p>

      {state === "idle" && (
        <div className="space-y-2">
          <button
            onClick={handleStart}
            className="w-full py-3 rounded-xl bg-accent-primary text-background font-semibold hover:opacity-90"
          >
            Generate QR Code
          </button>
          {/* DEV ONLY — remove before production */}
          <button
            onClick={() => { setState("done"); setTimeout(onVerified, 800); }}
            className="w-full py-2 rounded-xl border border-border text-xs text-text-secondary hover:opacity-80"
          >
            [Dev] Simulate Verification
          </button>
        </div>
      )}

      {state === "scanning" && selfApp && (
        <div className="flex flex-col items-center space-y-3">
          <SelfQRcodeWrapper
            selfApp={selfApp}
            onSuccess={handleSuccess}
            onError={handleError}
            size={280}
            darkMode={false}
          />
          <p className="text-sm text-text-secondary animate-pulse">Waiting for scan...</p>
        </div>
      )}

      {state === "done" && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center py-4"
        >
          <p className="text-4xl">✅</p>
          <p className="mt-2 font-semibold text-accent-primary">Identity Verified</p>
        </motion.div>
      )}

      {state === "error" && (
        <div className="text-center py-4 space-y-3">
          <p className="text-text-secondary text-sm">Verification failed. Please try again.</p>
          <button
            onClick={() => setState("idle")}
            className="px-4 py-2 rounded-lg bg-surface border border-border text-sm hover:opacity-80"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
