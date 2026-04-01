"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

interface LogEntry { id: string; time: string; message: string; type: "info" | "success" | "warning"; }

const COLOR = { info: "rgba(25,25,24,0.4)", success: "#16a34a", warning: "#c48c5a", reasoning: "#7c3aed", error: "#dc2626" };

export function AgentActivityFeed() {
  const { data: logs = [] } = useQuery<LogEntry[]>({
    queryKey: ["activity"],
    queryFn: async () => {
      const res = await fetch("/api/activity");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 5000,
  });

  return (
    <div className="m-card">
      <p className="m-label" style={{ marginBottom: "1rem" }}>Agent Activity Feed</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", fontFamily: "var(--font-mono, monospace)", fontSize: "0.7rem", maxHeight: 192, overflowY: "auto" }}>
        <AnimatePresence initial={false}>
          {logs.length === 0 && (
            <span style={{ color: "rgba(25,25,24,0.3)" }}>Waiting for agent tick...</span>
          )}
          {logs.map((log) => (
            <motion.div key={log.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              style={{ display: "flex", gap: "0.75rem", color: COLOR[log.type as keyof typeof COLOR] }}>
              <span style={{ color: "rgba(25,25,24,0.3)", flexShrink: 0 }}>{log.time}</span>
              <span>— {log.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
