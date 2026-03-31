import lighthouse from "lighthouse";
import Redis from "ioredis";
import type { AgentMemoryEntry, TickResult, AgentState } from "@mentoguard/shared";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

// ─── Filecoin / Lighthouse ────────────────────────────────────────────────────

async function uploadToLighthouse(data: unknown): Promise<string> {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });

  // @ts-expect-error – Lighthouse SDK types vary by version
  const result = await lighthouse.uploadText(json, process.env.LIGHTHOUSE_API_KEY ?? "");
  return result.data.Hash as string;
}

export async function saveLastTick(result: TickResult): Promise<void> {
  await redis.set("mentoguard:last_tick", JSON.stringify(result), "EX", 300);
}

export async function logTick(result: TickResult): Promise<string> {
  const entry: AgentMemoryEntry = {
    type: "tick",
    timestamp: result.tickAt,
    data: {
      rates: result.rates,
      drift: result.drift,
      shouldRebalance: result.shouldRebalance,
    },
  };
  const cid = await uploadToLighthouse(entry);
  await redis.set("mentoguard:last_tick_cid", cid);
  return cid;
}

export async function logRebalance(data: {
  swap: unknown;
  txHash: string;
  quote: unknown;
  timestamp: number;
}): Promise<string> {
  const entry: AgentMemoryEntry = {
    type: "rebalance",
    timestamp: data.timestamp,
    data,
    txHash: data.txHash,
  };
  const cid = await uploadToLighthouse(entry);
  await redis.lpush("mentoguard:rebalance_cids", cid);
  await redis.ltrim("mentoguard:rebalance_cids", 0, 99); // keep last 100
  return cid;
}

// ─── User Config ──────────────────────────────────────────────────────────────

export async function loadUserConfig() {
  const raw = await redis.get("mentoguard:user_config");
  if (!raw) return null;
  const config = JSON.parse(raw);
  // Migration: clear configs that predate CELO support so defaults take effect
  if (config?.targetAllocation && !("CELO" in config.targetAllocation)) {
    console.log("[memory] Clearing legacy user_config (pre-CELO), will use new defaults");
    await redis.del("mentoguard:user_config");
    return null;
  }
  return config;
}

export async function saveUserConfig(config: unknown): Promise<void> {
  await redis.set("mentoguard:user_config", JSON.stringify(config));
}

// ─── Agent State ──────────────────────────────────────────────────────────────

export async function saveAgentState(state: AgentState): Promise<void> {
  await redis.set("mentoguard:agent_state", JSON.stringify(state));
}

export async function loadAgentState(): Promise<AgentState | null> {
  const raw = await redis.get("mentoguard:agent_state");
  if (!raw) return null;
  return JSON.parse(raw) as AgentState;
}

// ─── Trade History ────────────────────────────────────────────────────────────

export async function getRebalanceCids(): Promise<string[]> {
  return redis.lrange("mentoguard:rebalance_cids", 0, 9);
}
