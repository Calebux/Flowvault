import type { Context } from "telegraf";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

export async function startCommand(ctx: Context) {
  const chatId = ctx.chat?.id.toString();
  if (chatId) {
    // Save chat ID so agent-core can push notifications
    const config = JSON.parse((await redis.get("flowvault:user_config")) ?? "{}");
    await redis.set(
      "flowvault:user_config",
      JSON.stringify({ ...config, telegramChatId: chatId })
    );
  }

  await ctx.reply(
    [
      "🛡️ *Welcome to FlowVault*",
      "",
      "Autonomous FX hedging for your Mento stablecoins on Celo.",
      "",
      "To get started:",
      "1. Visit the dashboard to verify your identity",
      "2. Configure your delegation rules",
      "3. The agent will monitor and rebalance automatically",
      "",
      `Dashboard: ${process.env.NEXT_PUBLIC_APP_URL ?? "https://flowvault.xyz"}`,
      "",
      "Use /help to see all commands.",
    ].join("\n"),
    { parse_mode: "Markdown" }
  );
}
