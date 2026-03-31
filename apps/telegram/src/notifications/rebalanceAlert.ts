import { Telegraf } from "telegraf";

export async function sendRebalanceAlert(
  chatId: string,
  data: {
    fromToken: string;
    toToken: string;
    amountUSD: number;
    txHash: string;
  }
): Promise<void> {
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
  const celoExplorer = `https://explorer.celo.org/tx/${data.txHash}`;

  await bot.telegram.sendMessage(
    chatId,
    [
      "🔄 *Rebalance Executed*",
      `${data.fromToken} → ${data.toToken}`,
      `Amount: $${data.amountUSD.toFixed(2)}`,
      `[View on Celo Explorer](${celoExplorer})`,
    ].join("\n"),
    { parse_mode: "Markdown" }
  );
}
