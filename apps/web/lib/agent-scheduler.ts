/**
 * agent-scheduler.ts
 *
 * In-process scheduler that calls runTick() directly every 30s.
 * Uses globalThis so the singleton survives Next.js hot reloads in dev
 * and persists for the lifetime of the Railway Node.js process in prod.
 */

import { runTick } from "@/lib/agent-tick";

type Scheduler = { intervalId: ReturnType<typeof setInterval> | null; running: boolean };
const g = globalThis as typeof globalThis & { __agentScheduler?: Scheduler };
if (!g.__agentScheduler) g.__agentScheduler = { intervalId: null, running: false };
const scheduler = g.__agentScheduler;

async function fireTick() {
  try { await runTick(); } catch { /* errors are handled inside runTick */ }
}

export function startScheduler(intervalMs = 30_000): void {
  if (scheduler.running) return;
  scheduler.running = true;
  void fireTick(); // immediate first tick, don't await
  scheduler.intervalId = setInterval(() => { void fireTick(); }, intervalMs);
}

export function stopScheduler(): void {
  if (!scheduler.running) return;
  if (scheduler.intervalId !== null) clearInterval(scheduler.intervalId);
  scheduler.intervalId = null;
  scheduler.running = false;
}

export function isSchedulerRunning(): boolean {
  return scheduler.running;
}
