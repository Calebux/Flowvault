import type { Context } from "telegraf";
import Redis from "ioredis";
import { formatUptime } from "@flowvault/shared";
import type { AgentState } from "@flowvault/shared";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

export async function statusCommand(ctx: Context) {
  const raw = await redis.get("flowvault:agent_state");
  const state: AgentState = raw
    ? JSON.parse(raw)
    : { status: "stopped", uptime: 0, totalTrades: 0, totalFeesUSD: 0 };

  const icon = state.status === "active" ? "🟢" : "🔴";

  await ctx.reply(
    [
      `${icon} *Agent Status: ${state.status.toUpperCase()}*`,
      "",
      `Uptime: ${formatUptime(state.uptime ?? 0)}`,
      `Total trades: ${state.totalTrades}`,
      `Total fees: $${(state.totalFeesUSD ?? 0).toFixed(4)}`,
    ].join("\n"),
    { parse_mode: "Markdown" }
  );
}
