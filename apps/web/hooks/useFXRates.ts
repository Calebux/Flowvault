"use client";

import { useQuery } from "@tanstack/react-query";
import type { FXRates } from "@flowvault/shared";

export function useFXRates() {
  const { data, isLoading } = useQuery<FXRates>({
    queryKey: ["fx-rates"],
    queryFn: async () => {
      const res = await fetch("/api/fx-rates");
      if (!res.ok) throw new Error("Failed to fetch FX rates");
      return res.json();
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  return { rates: data, isLoading };
}
