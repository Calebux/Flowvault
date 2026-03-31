"use client";

import { useQuery } from "@tanstack/react-query";
import type { Trade } from "@mentoguard/shared";

export function useTradeHistory() {
  const { data, isLoading } = useQuery<{ trades: Trade[] }>({
    queryKey: ["trade-history"],
    queryFn: async () => {
      const res = await fetch("/api/history");
      return res.json();
    },
    refetchInterval: 15_000,
  });

  return { trades: data?.trades ?? [], isLoading };
}
