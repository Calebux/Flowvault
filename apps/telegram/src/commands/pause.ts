import type { Context } from "telegraf";
import axios from "axios";

export async function pauseCommand(ctx: Context) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await axios.post(`${appUrl}/api/agent/stop`);
  await ctx.reply("⏸ Agent paused. Use /resume to restart.", { parse_mode: "Markdown" });
}
