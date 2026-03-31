import type { Context } from "telegraf";
import axios from "axios";

export async function resumeCommand(ctx: Context) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await axios.post(`${appUrl}/api/agent/start`);
  await ctx.reply("▶️ Agent resumed. Monitoring FX rates every 60s.", { parse_mode: "Markdown" });
}
