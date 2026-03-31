import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../../.env") });

import cron from "node-cron";
import { monitorTick } from "./monitor";
import { loadUserConfig, loadAgentState, saveAgentState, saveLastTick } from "./memory";
import { sendTelegramMessage } from "./notifications";
import { decideAction } from "./llm";
import { computeRebalanceSwaps } from "./strategy";
import { executeSwap } from "./executor";
import { getYieldPosition, depositToYield, withdrawFromYield } from "./yield-vaults";
import { fetchOnChainRules } from "./delegation";
import {
  MONITOR_INTERVAL_SECONDS,
  DEFAULT_TARGET_ALLOCATION,
  DEFAULT_DRIFT_THRESHOLD,
  DEFAULT_DELEGATION_RULES,
} from "@flowvault/shared";
import type { AgentState, UserConfig } from "@flowvault/shared";

let isRunning = false;
let startedAt: number | null = null;
let totalTrades = 0;
let totalFeesUSD = 0;
let cronJob: cron.ScheduledTask | null = null;

export function getAgentState(): AgentState {
  return {
    status: isRunning ? "active" : "stopped",
    startedAt,
    lastTickAt: null,
    totalTrades,
    totalFeesUSD,
    uptime: startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0,
  };
}

export async function startAgent(): Promise<void> {
  if (isRunning) return;

  isRunning = true;
  startedAt = Date.now();
  console.log("[FlowVault] Agent starting...");
  await saveAgentState({ status: "active", startedAt, totalTrades, totalFeesUSD, lastTickAt: null, uptime: 0 });

  cronJob = cron.schedule(`*/${MONITOR_INTERVAL_SECONDS} * * * * *`, async () => {
    try {
      // Check if paused via dashboard
      const agentState = await loadAgentState();
      if (agentState?.status === "stopped") {
        console.log("[FlowVault] Agent paused — skipping tick");
        return;
      }

      const stored = await loadUserConfig();
      const envSmartAccount = (process.env.FLOW_SMART_ACCOUNT_ADDRESS ?? "") as `0x${string}`;
      const smartAccount = (stored?.smartAccount || envSmartAccount) as `0x${string}`;
      if (!smartAccount) {
        console.warn("[FlowVault] No smart account set, skipping tick");
        return;
      }

      const defaultConfig: UserConfig = {
        smartAccount,
        targetAllocation: DEFAULT_TARGET_ALLOCATION,
        driftThreshold: DEFAULT_DRIFT_THRESHOLD,
        rules: DEFAULT_DELEGATION_RULES as UserConfig["rules"],
        selfVerified: false,
        ensName: null,
        telegramChatId: process.env.TELEGRAM_CHAT_ID ?? null,
      };
      let userConfig: UserConfig = stored
        ? {
            ...defaultConfig,
            ...stored,
            smartAccount,
            telegramChatId: stored.telegramChatId ?? defaultConfig.telegramChatId,
            // Ensure new token fields present in stored configs from before the upgrade
            targetAllocation: { ...DEFAULT_TARGET_ALLOCATION, ...stored.targetAllocation },
          }
        : defaultConfig;

      // Merge on-chain delegation rules (FlowVaultRules contract) with local config
      const onChainRules = await fetchOnChainRules(userConfig.rules);
      if (onChainRules.paused) {
        console.log("[FlowVault] Agent paused via on-chain contract — skipping tick");
        return;
      }
      userConfig = { ...userConfig, rules: onChainRules };

      // 1. Observe — fetch token prices + portfolio state + yield positions
      const result = await monitorTick(userConfig);
      saveLastTick(result).catch(() => {});

      // Fetch yield positions for all tracked tokens
      const yieldPositions: Record<string, number> = {};
      for (const { token, address } of result.balances) {
        const rate = (result.rates as unknown as Record<string, number>)[token] ?? 0;
        if (rate > 0) {
          yieldPositions[token] = await getYieldPosition(address, smartAccount, rate);
        }
      }
      const totalYieldUSD = Object.values(yieldPositions).reduce((s, v) => s + v, 0);
      if (totalYieldUSD > 0.01) console.log(`[FlowVault] Yield positions: $${totalYieldUSD.toFixed(2)}`);

      console.log(`[FlowVault] Tick — asking Hermes to decide...`);

      // 2. Decide — Hermes analyzes context and calls tools
      let decisions = await decideAction(result, userConfig, yieldPositions);

      // Override: if drift clearly exceeds threshold but Hermes only sent alerts, force a swap
      const totalUSDCheck = result.balances.reduce((s, b) => s + b.balanceUSD, 0);
      const hasSwap = decisions.some(d => d.action === "execute_swap");
      if (result.shouldRebalance && !hasSwap && totalUSDCheck > 0.01) {
        const swaps = computeRebalanceSwaps(result.drift, result.currentAllocation, totalUSDCheck);
        if (swaps.length > 0) {
          const s = swaps[0];
          console.log(`[FlowVault] Overriding alert-only decision — forcing swap`);
          decisions = [{ action: "execute_swap", fromToken: s.fromToken, toToken: s.toToken, amountUSD: s.amountUSD, reason: "Drift exceeds threshold — forced rebalance" }];
        }
      }

      // 3. Act — execute whatever Hermes decided
      for (const decision of decisions) {
        console.log(`[FlowVault] Hermes decision: ${decision.action}`);

        if (decision.action === "execute_swap") {
          const { fromToken, toToken, amountUSD, reason } = decision;
          console.log(`[FlowVault] Swap: ${fromToken}→${toToken} $${amountUSD.toFixed(2)} — ${reason}`);

          // Find the swap instruction from strategy
          const totalUSD = result.balances.reduce((s, b) => s + b.balanceUSD, 0);
          const swaps = computeRebalanceSwaps(result.drift, result.currentAllocation, totalUSD);
          const swap = swaps.find(s => s.fromToken === fromToken && s.toToken === toToken)
            ?? swaps[0];

          if (swap) {
            // Cap swap amount to actual available balance of fromToken
            const fromBalance = result.balances.find(b => b.token === fromToken);
            const maxAvailable = fromBalance?.balanceUSD ?? 0;
            const cappedAmount = Math.min(amountUSD, maxAvailable * 0.95); // 95% to leave gas buffer
            if (cappedAmount < 0.01) {
              console.warn(`[FlowVault] Swap skipped — insufficient ${fromToken} balance ($${maxAvailable.toFixed(2)})`);
              continue;
            }
            try {
              const txHash = await executeSwap(
                { ...swap, amountUSD: cappedAmount },
                userConfig.smartAccount,
                userConfig.rules
              );
              totalTrades++;
              console.log(`[FlowVault] Swap confirmed: ${txHash}`);
              await sendTelegramMessage(
                userConfig.telegramChatId,
                `🔄 Rebalance executed\n\n${fromToken} → ${toToken} $${cappedAmount.toFixed(2)}\n\nTx: ${txHash}`
              );
            } catch (swapErr) {
              const errMsg = (swapErr as Error).message ?? "";
              const isOracleStale = errMsg.includes("no valid median") || errMsg.includes("oracle stale");
              console.warn(`[FlowVault] Swap failed:`, swapErr);
              if (!isOracleStale) {
                await sendTelegramMessage(
                  userConfig.telegramChatId,
                  `⚠️ Rebalance attempted but failed\n\n${reason}`
                );
              } else {
                console.log(`[FlowVault] Oracle stale for ${fromToken}→${toToken} — skipping alert, will retry next tick`);
              }
            }
          }

        } else if (decision.action === "deposit_to_yield" || decision.action === "withdraw_from_yield") {
          const { token, amountUSD, reason } = decision as { token: string; amountUSD: number; reason: string };
          const tokenAddress = result.balances.find(b => b.token === token)?.address as `0x${string}` | undefined;
          if (!tokenAddress) { console.warn(`[FlowVault] Unknown token for yield: ${token}`); continue; }
          try {
            const txHash = decision.action === "deposit_to_yield"
              ? await depositToYield(tokenAddress, amountUSD, token)
              : await withdrawFromYield(tokenAddress, amountUSD, token);
            totalTrades++;
            const emoji = decision.action === "deposit_to_yield" ? "🏦" : "💸";
            const verb = decision.action === "deposit_to_yield" ? "Deposited to yield" : "Withdrawn from yield";
            await sendTelegramMessage(
              userConfig.telegramChatId,
              `${emoji} ${verb}\n\n${token} $${amountUSD.toFixed(2)} — ${reason}\n\nTx: ${txHash}`
            );
          } catch (err) {
            console.warn(`[FlowVault] Yield ${decision.action} failed:`, err);
          }

        } else if (decision.action === "send_alert") {
          const emoji = decision.severity === "critical" ? "🚨" : decision.severity === "warning" ? "⚠️" : "ℹ️";
          await sendTelegramMessage(
            userConfig.telegramChatId,
            `${emoji} ${decision.message}`
          );

        } else {
          // hold
          console.log(`[FlowVault] Holding — ${decision.reason}`);
        }
      }

      // Auto-deploy idle stablecoins to yield only when portfolio is balanced
      // Gated on !shouldRebalance so funds stay in yield long enough to earn —
      // depositing during drift would just trigger an immediate withdraw on the next swap
      const YIELD_TOKENS = ["USDC", "USDT"] as const;
      const MIN_DEPOSIT_USD = 0.50;
      if (!result.shouldRebalance) for (const token of YIELD_TOKENS) {
        const balance = result.balances.find(b => b.token === token);
        const walletBalanceUSD = balance?.balanceUSD ?? 0;
        const yieldBalanceUSD = yieldPositions[token] ?? 0;
        // Only deposit if wallet holds more than yield position (funds actually idle)
        const idleUSD = walletBalanceUSD - yieldBalanceUSD;
        if (idleUSD >= MIN_DEPOSIT_USD) {
          const depositUSD = idleUSD * 0.8; // deploy 80%, keep 20% liquid for gas/swaps
          const tokenAddress = balance?.address as `0x${string}` | undefined;
          if (!tokenAddress) continue;
          try {
            console.log(`[FlowVault] Auto-deploying $${depositUSD.toFixed(2)} ${token} idle balance to yield`);
            const txHash = await depositToYield(tokenAddress, depositUSD, token);
            totalTrades++;
            yieldPositions[token] = yieldBalanceUSD + depositUSD; // update local state
            await sendTelegramMessage(
              userConfig.telegramChatId,
              `🏦 Yield deployed\n\n${token} $${depositUSD.toFixed(2)} → IncrementFi\n\nTx: ${txHash}`
            );
          } catch (err) {
            console.warn(`[FlowVault] Auto-deposit ${token} failed:`, err);
          }
        }
      }

      await saveAgentState({
        status: "active",
        startedAt,
        lastTickAt: result.tickAt,
        totalTrades,
        totalFeesUSD,
        uptime: Math.floor((Date.now() - (startedAt ?? Date.now())) / 1000),
      });
    } catch (err) {
      console.error("[FlowVault] Tick error:", err);
    }
  });

  console.log(`[FlowVault] Running — Hermes decides every ${MONITOR_INTERVAL_SECONDS}s`);
}

export async function stopAgent(): Promise<void> {
  if (!isRunning) return;
  cronJob?.stop();
  isRunning = false;
  await saveAgentState({
    status: "stopped",
    startedAt,
    lastTickAt: null,
    totalTrades,
    totalFeesUSD,
    uptime: startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0,
  });
  console.log("[FlowVault] Agent stopped.");
}

if (require.main === module) {
  startAgent().catch(console.error);
}
