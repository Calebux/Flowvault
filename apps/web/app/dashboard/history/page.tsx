"use client";

import { useTradeHistory } from "@/hooks/useTradeHistory";
import { formatUSD } from "@mentoguard/shared";

export default function HistoryPage() {
  const { trades, isLoading } = useTradeHistory();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Trade History</h1>
      <p className="text-text-secondary text-sm">
        Every rebalance is stored permanently on Filecoin via Lighthouse.
      </p>

      <div className="rounded-xl bg-surface border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-text-secondary font-medium">Time</th>
              <th className="text-left px-4 py-3 text-text-secondary font-medium">Swap</th>
              <th className="text-left px-4 py-3 text-text-secondary font-medium">Amount</th>
              <th className="text-left px-4 py-3 text-text-secondary font-medium">Tx Hash</th>
              <th className="text-left px-4 py-3 text-text-secondary font-medium">Filecoin CID</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-secondary">
                  Loading...
                </td>
              </tr>
            ) : trades.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-secondary">
                  No trades yet. The agent will execute swaps when drift exceeds your threshold.
                </td>
              </tr>
            ) : (
              trades.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-border/20">
                  <td className="px-4 py-3 font-mono text-xs">
                    {new Date(t.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-accent-primary">{t.fromToken}</span>
                    {" → "}
                    <span className="text-accent-primary">{t.toToken}</span>
                  </td>
                  <td className="px-4 py-3">{formatUSD(parseFloat(t.fromAmount))}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                    <a
                      href={`https://explorer.celo.org/tx/${t.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-accent-primary underline"
                    >
                      {t.txHash.slice(0, 10)}...
                    </a>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                    {t.filecoinCid ? (
                      <a
                        href={`https://gateway.lighthouse.storage/ipfs/${t.filecoinCid}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-accent-primary underline"
                      >
                        {t.filecoinCid.slice(0, 12)}...
                      </a>
                    ) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
