/**
 * agent-scheduler.ts
 *
 * In-process scheduler that fires Hermes AI ticks on a fixed interval.
 * Uses globalThis so the singleton survives Next.js hot reloads in dev
 * and persists for the lifetime of the Railway Node.js process in prod.
 */

type Scheduler = {
  intervalId: ReturnType<typeof setInterval> | null;
  running: boolean;
};

const g = globalThis as typeof globalThis & { __agentScheduler?: Scheduler };
if (!g.__agentScheduler) g.__agentScheduler = { intervalId: null, running: false };
const scheduler = g.__agentScheduler;

function getBaseUrl(): string {
  // Railway injects RAILWAY_PUBLIC_DOMAIN; fall back to NEXT_PUBLIC_APP_URL for local dev
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

async function fireTick() {
  try {
    await fetch(`${getBaseUrl()}/api/agent/tick`, { method: "POST" });
  } catch {
    // swallow — Redis / network errors are handled inside the tick route
  }
}

export function startScheduler(intervalMs = 30_000): void {
  if (scheduler.running) return;
  scheduler.running = true;
  fireTick(); // immediate first tick
  scheduler.intervalId = setInterval(fireTick, intervalMs);
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
