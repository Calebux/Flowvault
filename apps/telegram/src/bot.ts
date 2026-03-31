import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../../.env") });

import { Telegraf, type Context } from "telegraf";
import { startCommand } from "./commands/start";
import { statusCommand } from "./commands/status";
import { portfolioCommand } from "./commands/portfolio";
import { pauseCommand } from "./commands/pause";
import { resumeCommand } from "./commands/resume";
import { historyCommand } from "./commands/history";
import { askCommand } from "./commands/ask";
import { handleTextMessage } from "./commands/configure";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.log("[FlowVault Bot] No TELEGRAM_BOT_TOKEN set — bot disabled. Exiting cleanly.");
  process.exit(0);
}

export const bot: Telegraf<Context> = new Telegraf(token);

// Commands
bot.start(startCommand);
bot.command("status", statusCommand);
bot.command("portfolio", portfolioCommand);
bot.command("pause", pauseCommand);
bot.command("resume", resumeCommand);
bot.command("history", historyCommand);
bot.command("ask", askCommand);

bot.command("help", (ctx) => {
  ctx.reply(
    [
      "🛡️ *FlowVault Commands*",
      "",
      "/status — Agent health & uptime",
      "/portfolio — Current allocation + drift",
      "/pause — Halt the agent",
      "/resume — Restart the agent",
      "/history — Last 10 swaps",
      "/ask <question> — Ask Hermes about your portfolio",
      "",
      "💬 *Or just type naturally:*",
      "\"set target to 60% cUSD 40% cEUR\"",
      "\"set threshold to 3%\"",
      "\"be more aggressive\"",
      "\"pause trading\"",
    ].join("\n"),
    { parse_mode: "Markdown" }
  );
});

// Natural language command handler — catches any plain text message
bot.on("text", handleTextMessage);

function launch(attempts = 0): void {
  bot.launch({ dropPendingUpdates: true }).catch(async (err: any) => {
    if (err?.response?.error_code === 409 && attempts < 5) {
      const delay = (attempts + 1) * 3000;
      console.log(`[FlowVault Bot] 409 conflict, retrying in ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
      launch(attempts + 1);
    } else {
      console.error("[FlowVault Bot] Fatal error:", err.message);
      process.exit(1);
    }
  });
  console.log("[FlowVault Bot] Running...");
}

launch();

process.once("SIGINT", () => { try { bot.stop("SIGINT"); } catch {} });
process.once("SIGTERM", () => { try { bot.stop("SIGTERM"); } catch {} });
