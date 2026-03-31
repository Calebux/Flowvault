import type { Context } from "telegraf";
import axios from "axios";

export async function historyCommand(ctx: Context) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await axios.get(`${appUrl}/api/history`);
  const { trades } = res.data as {
    trades: Array<{
      timestamp: number;
      fromToken: string;
      toToken: string;
      fromAmount: string;
      txHash: string;
    }>;
  };

  if (trades.length === 0) {
    return ctx.reply("No trades yet.");
  }

  const lines = trades.slice(0, 10).map((t) => {
    const time = new Date(t.timestamp).toLocaleTimeString();
    return `• ${time} — ${t.fromToken}→${t.toToken} $${parseFloat(t.fromAmount).toFixed(2)}`;
  });

  await ctx.reply(
    ["📋 *Last 10 Trades*", "", ...lines].join("\n"),
    { parse_mode: "Markdown" }
  );
}
