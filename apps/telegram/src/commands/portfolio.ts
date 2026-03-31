import type { Context } from "telegraf";
import axios from "axios";

export async function portfolioCommand(ctx: Context) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await axios.get(`${appUrl}/api/portfolio`);
    const { balances, totalUSD } = res.data as {
      balances: Array<{ token: string; balanceUSD: number }>;
      totalUSD: number;
    };

    const lines = balances.map((b) => {
      const pct = totalUSD > 0 ? ((b.balanceUSD / totalUSD) * 100).toFixed(1) : "0";
      return `${b.token}: $${b.balanceUSD.toFixed(2)} (${pct}%)`;
    });

    await ctx.reply(
      ["📊 *Portfolio*", "", ...lines, "", `Total: $${totalUSD.toFixed(2)}`].join("\n"),
      { parse_mode: "Markdown" }
    );
  } catch {
    await ctx.reply("Could not fetch portfolio. Is the dashboard running?");
  }
}
