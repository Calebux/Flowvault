import { Telegraf } from "telegraf";

export async function sendDriftAlert(
  chatId: string,
  data: {
    token: string;
    drift: number;
    threshold: number;
  }
): Promise<void> {
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

  await bot.telegram.sendMessage(
    chatId,
    [
      "⚠️ *FX Drift Warning*",
      `${data.token} has drifted ${data.drift.toFixed(1)}% from target`,
      `Threshold: ${data.threshold}%`,
      "A rebalance may execute shortly.",
    ].join("\n"),
    { parse_mode: "Markdown" }
  );
}
