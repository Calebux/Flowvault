"use client";

import { useQuery } from "@tanstack/react-query";
import type { TokenBalance, TargetAllocation } from "@flowvault/shared";

interface PortfolioData {
  balances: TokenBalance[];
  targetAllocation: TargetAllocation;
  totalUSD: number;
}

export function usePortfolio() {
  const { data, isLoading } = useQuery<PortfolioData>({
    queryKey: ["portfolio"],
    queryFn: async () => {
      const res = await fetch("/api/portfolio");
      return res.json();
    },
    refetchInterval: 10_000,
  });

  return {
    balances: data?.balances ?? [],
    targetAllocation: data?.targetAllocation,
    totalUSD: data?.totalUSD ?? 0,
    isLoading,
  };
}
