"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AgentState } from "@flowvault/shared";

async function fetchStatus(): Promise<AgentState> {
  const res = await fetch("/api/agent/status");
  return res.json();
}

export function useAgentStatus() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<AgentState>({
    queryKey: ["agent-status"],
    queryFn: fetchStatus,
    refetchInterval: 3000,
  });

  const start = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/agent/start", { method: "POST" });
      return res.json(); // always returns {success, state}
    },
    // onSettled fires on both success and error — always refresh status
    onSettled: () => qc.invalidateQueries({ queryKey: ["agent-status"] }),
  });

  const stop = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/agent/stop", { method: "POST" });
      return res.json();
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["agent-status"] }),
  });

  return { status: data, isLoading, start: start.mutate, stop: stop.mutate };
}
