"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_DELEGATION_RULES } from "@mentoguard/shared";
import type { DelegationRules } from "@mentoguard/shared";

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-text-secondary">{label}</span>
        <span className="font-mono font-medium">
          {unit}{value.toLocaleString()}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#00d4aa]"
      />
    </div>
  );
}

export function DelegationRuleForm() {
  const qc = useQueryClient();

  const { data: savedRules } = useQuery<DelegationRules>({
    queryKey: ["rules"],
    queryFn: async () => {
      const res = await fetch("/api/rules");
      return res.json();
    },
  });

  const [rules, setRules] = useState<DelegationRules>(
    savedRules ?? DEFAULT_DELEGATION_RULES
  );

  const save = useMutation({
    mutationFn: async (r: DelegationRules) => {
      await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(r),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }),
  });

  return (
    <div className="rounded-xl bg-surface border border-border p-6 space-y-6">
      <Slider
        label="Max single swap"
        value={rules.maxSwapAmountUSD}
        min={10}
        max={5000}
        step={10}
        unit="$"
        onChange={(v) => setRules({ ...rules, maxSwapAmountUSD: v })}
      />

      <Slider
        label="Max daily volume"
        value={rules.maxDailyVolumeUSD}
        min={100}
        max={20000}
        step={100}
        unit="$"
        onChange={(v) => setRules({ ...rules, maxDailyVolumeUSD: v })}
      />

      <Slider
        label="Require human approval above"
        value={rules.requireHumanApprovalAbove}
        min={100}
        max={10000}
        step={100}
        unit="$"
        onChange={(v) => setRules({ ...rules, requireHumanApprovalAbove: v })}
      />

      <div className="space-y-1.5">
        <label className="text-sm text-text-secondary">Operating Hours (UTC)</label>
        <div className="flex gap-3 items-center">
          <input
            type="number"
            min={0}
            max={23}
            value={rules.timeWindow.startHour}
            onChange={(e) =>
              setRules({ ...rules, timeWindow: { ...rules.timeWindow, startHour: Number(e.target.value) } })
            }
            className="w-20 bg-background border border-border rounded-lg px-3 py-1.5 text-sm font-mono text-center"
          />
          <span className="text-text-secondary">to</span>
          <input
            type="number"
            min={0}
            max={24}
            value={rules.timeWindow.endHour}
            onChange={(e) =>
              setRules({ ...rules, timeWindow: { ...rules.timeWindow, endHour: Number(e.target.value) } })
            }
            className="w-20 bg-background border border-border rounded-lg px-3 py-1.5 text-sm font-mono text-center"
          />
          <span className="text-text-secondary text-sm">UTC</span>
        </div>
      </div>

      <div className="pt-2 border-t border-border">
        <button
          onClick={() => save.mutate(rules)}
          disabled={save.isPending}
          className="w-full py-2.5 rounded-xl bg-accent-primary text-background font-semibold hover:opacity-90 disabled:opacity-50 transition"
        >
          {save.isPending ? "Saving to chain..." : "Save Rules (confirm in MetaMask)"}
        </button>
        {save.isSuccess && (
          <p className="text-xs text-green-400 text-center mt-2">Rules saved onchain ✓</p>
        )}
      </div>
    </div>
  );
}
