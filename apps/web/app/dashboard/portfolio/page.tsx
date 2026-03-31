"use client";

import { ExposureDonut } from "@/components/ExposureDonut";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useFXRates } from "@/hooks/useFXRates";
import { formatUSD } from "@flowvault/shared";

export default function PortfolioPage() {
  const { balances, isLoading } = usePortfolio();
  const { rates } = useFXRates();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Portfolio Exposure</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ExposureDonut />

        <div className="rounded-xl bg-surface border border-border p-5 space-y-3">
          <h3 className="text-sm font-medium text-text-secondary">Holdings</h3>
          {isLoading ? (
            <p className="text-text-secondary text-sm">Loading...</p>
          ) : (
            balances.map((b) => (
              <div key={b.token} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                <span className="font-medium">{b.token}</span>
                <span className="text-text-secondary text-sm">{formatUSD(b.balanceUSD)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl bg-surface border border-border p-5">
        <h3 className="text-sm font-medium text-text-secondary mb-3">Live FX Rates (USD)</h3>
        <div className="grid grid-cols-4 gap-4">
          {rates && Object.entries(rates)
            .filter(([k]) => k !== "updatedAt")
            .map(([token, rate]) => (
              <div key={token} className="text-center">
                <p className="text-text-secondary text-xs">{token}</p>
                <p className="font-mono text-lg font-bold">{(rate as number).toFixed(4)}</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
