import type { Context } from "telegraf";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

const BASE_URL = process.env.HERMES_BASE_URL ?? "https://inference-api.nousresearch.com/v1";
const API_KEY  = process.env.HERMES_API_KEY ?? "";
const MODEL    = process.env.HERMES_MODEL ?? "hermes-4-70b";

const SYSTEM = `You are MentoGuard, an autonomous FX hedging agent for Mento stablecoins on Celo.
You monitor cUSD, cEUR, cBRL and cREAL allocations and rebalance when drift exceeds thresholds.
Be concise and precise. Never use markdown formatting.`;

async function askHermes(question: string, context: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `${context}\n\nUser question: ${question}` },
      ],
      temperature: 0.4,
      max_tokens: 512,
    }),
  });
  if (!res.ok) throw new Error(`Hermes error: ${res.status}`);
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? "No response.";
}

export async function askCommand(ctx: Context): Promise<void> {
  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const question = text.replace(/^\/ask\s*/i, "").trim();

  if (!question) {
    await ctx.reply("Usage: /ask <your question>\nExample: /ask why did you rebalance?");
    return;
  }

  await ctx.reply("Thinking…");

  try {
    const tickRaw = await redis.get("mentoguard:last_tick");
    if (!tickRaw) {
      await ctx.reply("No tick data yet — the agent may still be starting up.");
      return;
    }

    const result = JSON.parse(tickRaw);
    const totalUSD = (result.balances as { balanceUSD: number }[]).reduce((s: number, b: { balanceUSD: number }) => s + b.balanceUSD, 0);

    const context = `Portfolio value: $${totalUSD.toFixed(2)}
Allocation: cUSD ${result.currentAllocation.cUSD.toFixed(1)}%, cEUR ${result.currentAllocation.cEUR.toFixed(1)}%, cBRL ${result.currentAllocation.cBRL.toFixed(1)}%, cREAL ${result.currentAllocation.cREAL.toFixed(1)}%
Drift: ${Object.entries(result.drift).map(([t, d]) => `${t}: ${(d as number) > 0 ? "+" : ""}${(d as number).toFixed(1)}%`).join(", ")}
FX rates: cEUR=$${result.rates.cEUR.toFixed(4)}, cBRL=$${result.rates.cBRL.toFixed(4)}
Rebalance needed: ${result.shouldRebalance ? "YES" : "NO"}`;

    const answer = await askHermes(question, context);
    await ctx.reply(answer);
  } catch (err) {
    console.error("[ask]", err);
    await ctx.reply("Sorry, couldn't get an answer right now. Try again in a moment.");
  }
}
