import type { Context } from "telegraf";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

const BASE_URL = process.env.HERMES_BASE_URL ?? "https://inference-api.nousresearch.com/v1";
const API_KEY  = process.env.HERMES_API_KEY ?? "";
const MODEL    = process.env.HERMES_MODEL || "Hermes-4-70B";

const TOOLS = [
  {
    type: "function",
    function: {
      name: "update_allocation",
      description: "Update the target treasury allocation. Percentages must sum to 100.",
      parameters: {
        type: "object",
        properties: {
          FLOW:   { type: "number", description: "Target % for FLOW (0-100)" },
          USDC:   { type: "number", description: "Target % for USDC (0-100)" },
          USDT:   { type: "number", description: "Target % for USDT (0-100)" },
          stFLOW: { type: "number", description: "Target % for stFLOW (0-100)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_threshold",
      description: "Update the drift threshold that triggers rebalancing.",
      parameters: {
        type: "object",
        properties: {
          driftThreshold: { type: "number", description: "Threshold in % (e.g. 5 means 5%)" },
        },
        required: ["driftThreshold"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pause_agent",
      description: "Pause the agent — stop all automatic rebalancing.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "resume_agent",
      description: "Resume the agent — restart automatic rebalancing.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "unknown_command",
      description: "User's message is not a configuration command — it's a question or conversation.",
      parameters: {
        type: "object",
        properties: {
          suggestion: { type: "string", description: "Brief suggestion of what the user can do instead" },
        },
        required: ["suggestion"],
      },
    },
  },
];

export async function handleTextMessage(ctx: Context): Promise<void> {
  const text = ctx.message && "text" in ctx.message ? ctx.message.text.trim() : "";
  if (!text || text.startsWith("/")) return;

  await ctx.reply("⚙️ Configuring…");

  try {
    const configRaw = await redis.get("flowvault:user_config");
    const config = configRaw ? JSON.parse(configRaw) : {};

    const currentState = `Current config:
- Target: FLOW ${config.targetAllocation?.FLOW ?? 40}%, USDC ${config.targetAllocation?.USDC ?? 30}%, USDT ${config.targetAllocation?.USDT ?? 20}%, stFLOW ${config.targetAllocation?.stFLOW ?? 10}%
- Drift threshold: ${config.driftThreshold ?? 5}%
- Agent status: ${(await redis.get("flowvault:agent_state").then(r => r ? JSON.parse(r).status : "unknown"))}`;

    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: `You are FlowVault's configuration assistant. The user is sending a natural language command to configure their DAO treasury agent.
Parse the user's intent and call the appropriate tool.
Supported tokens: FLOW, USDC, USDT, stFLOW.
If the user says "more aggressive" → lower drift threshold. "more conservative" → raise it.
If percentages don't sum to 100, normalise them proportionally before calling the tool.`,
          },
          { role: "user", content: `${currentState}\n\nUser command: "${text}"` },
        ],
        tools: TOOLS,
        tool_choice: "auto",
        temperature: 0.1,
        max_tokens: 512,
      }),
    });

    if (!res.ok) throw new Error(`Hermes error: ${res.status}`);
    const data = await res.json() as {
      choices: { message: { tool_calls?: { function: { name: string; arguments: string } }[] } }[];
    };

    const call = data.choices[0]?.message?.tool_calls?.[0];
    if (!call) {
      await ctx.reply("I didn't understand that. Try: \"set target to 60% FLOW 40% USDC\" or \"set threshold to 3%\"");
      return;
    }

    const args = JSON.parse(call.function.arguments);

    if (call.function.name === "update_allocation") {
      const newAlloc = {
        FLOW:   args.FLOW   ?? config.targetAllocation?.FLOW   ?? 40,
        USDC:   args.USDC   ?? config.targetAllocation?.USDC   ?? 30,
        USDT:   args.USDT   ?? config.targetAllocation?.USDT   ?? 20,
        stFLOW: args.stFLOW ?? config.targetAllocation?.stFLOW ?? 10,
      };
      await redis.set("flowvault:user_config", JSON.stringify({ ...config, targetAllocation: newAlloc }));
      await ctx.reply(
        `✅ Target allocation updated:\n\nFLOW: ${newAlloc.FLOW}%\nUSDC: ${newAlloc.USDC}%\nUSDT: ${newAlloc.USDT}%\nstFLOW: ${newAlloc.stFLOW}%\n\nAgent will rebalance towards this on next tick.`
      );

    } else if (call.function.name === "update_threshold") {
      await redis.set("flowvault:user_config", JSON.stringify({ ...config, driftThreshold: args.driftThreshold }));
      await ctx.reply(`✅ Drift threshold set to ${args.driftThreshold}%\n\nAgent will rebalance when any token drifts more than ${args.driftThreshold}% from target.`);

    } else if (call.function.name === "pause_agent") {
      const stateRaw = await redis.get("flowvault:agent_state");
      const state = stateRaw ? JSON.parse(stateRaw) : {};
      await redis.set("flowvault:agent_state", JSON.stringify({ ...state, status: "stopped" }));
      await ctx.reply("⏸️ Agent paused. Send \"resume\" to restart.");

    } else if (call.function.name === "resume_agent") {
      const stateRaw = await redis.get("flowvault:agent_state");
      const state = stateRaw ? JSON.parse(stateRaw) : {};
      await redis.set("flowvault:agent_state", JSON.stringify({ ...state, status: "active" }));
      await ctx.reply("▶️ Agent resumed. Rebalancing will continue on next tick.");

    } else {
      await ctx.reply(`I can help you configure your agent. Try:\n\n• "set target to 60% FLOW 40% USDC"\n• "set threshold to 3%"\n• "be more aggressive"\n• "pause" / "resume"\n\n${args.suggestion ?? ""}`);
    }

  } catch (err) {
    console.error("[configure]", err);
    await ctx.reply("Something went wrong. Try /help for available commands.");
  }
}
