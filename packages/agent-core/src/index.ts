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
import { getAavePosition, depositToAave, withdrawFromAave } from "./aave";
import { fetchOnChainRules } from "./delegation";
import {
  MONITOR_INTERVAL_SECONDS,
  DEFAULT_TARGET_ALLOCATION,
  DEFAULT_DRIFT_THRESHOLD,
  DEFAULT_DELEGATION_RULES,
} from "@mentoguard/shared";
import type { AgentState, UserConfig } from "@mentoguard/shared";

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
  console.log("[MentoGuard] Agent starting...");
  await saveAgentState({ status: "active", startedAt, totalTrades, totalFeesUSD, lastTickAt: null, uptime: 0 });

  cronJob = cron.schedule(`*/${MONITOR_INTERVAL_SECONDS} * * * * *`, async () => {
    try {
      // Check if paused via dashboard
      const agentState = await loadAgentState();
      if (agentState?.status === "stopped") {
        console.log("[MentoGuard] Agent paused — skipping tick");
        return;
      }

      const stored = await loadUserConfig();
      const envSmartAccount = (process.env.CELO_SMART_ACCOUNT_ADDRESS ?? "") as `0x${string}`;
      const smartAccount = (stored?.smartAccount || envSmartAccount) as `0x${string}`;
      if (!smartAccount) {
        console.warn("[MentoGuard] No smart account set, skipping tick");
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
            // Ensure new token fields (e.g. CELO) present in stored configs from before the upgrade
            targetAllocation: { ...DEFAULT_TARGET_ALLOCATION, ...stored.targetAllocation },
          }
        : defaultConfig;

      // Merge on-chain delegation rules (MentoGuardRules contract) with local config
      const onChainRules = await fetchOnChainRules(userConfig.rules);
      if (onChainRules.paused) {
        console.log("[MentoGuard] Agent paused via on-chain contract — skipping tick");
        return;
      }
      userConfig = { ...userConfig, rules: onChainRules };

      // 1. Observe — fetch FX rates + portfolio state + Aave positions
      const result = await monitorTick(userConfig);
      saveLastTick(result).catch(() => {});

      // Fetch Aave positions for all tracked tokens
      const aavePositions: Record<string, number> = {};
      for (const { token, address } of result.balances) {
        const rate = (result.rates as Record<string, number>)[token] ?? 0;
        if (rate > 0) {
          aavePositions[token] = await getAavePosition(address, smartAccount, rate);
        }
      }
      const totalAaveUSD = Object.values(aavePositions).reduce((s, v) => s + v, 0);
      if (totalAaveUSD > 0.01) console.log(`[MentoGuard] Aave positions: $${totalAaveUSD.toFixed(2)}`);

      console.log(`[MentoGuard] Tick — asking Hermes to decide...`);

      // 2. Decide — Hermes analyzes context and calls tools
      let decisions = await decideAction(result, userConfig, aavePositions);

      // Override: if drift clearly exceeds threshold but Hermes only sent alerts, force a swap
      const totalUSDCheck = result.balances.reduce((s, b) => s + b.balanceUSD, 0);
      const hasSwap = decisions.some(d => d.action === "execute_swap");
      if (result.shouldRebalance && !hasSwap && totalUSDCheck > 0.01) {
        const swaps = computeRebalanceSwaps(result.drift, result.currentAllocation, totalUSDCheck);
        if (swaps.length > 0) {
          const s = swaps[0];
          console.log(`[MentoGuard] Overriding alert-only decision — forcing swap`);
          decisions = [{ action: "execute_swap", fromToken: s.fromToken, toToken: s.toToken, amountUSD: s.amountUSD, reason: "Drift exceeds threshold — forced rebalance" }];
        }
      }

      // 3. Act — execute whatever Hermes decided
      for (const decision of decisions) {
        console.log(`[MentoGuard] Hermes decision: ${decision.action}`);

        if (decision.action === "execute_swap") {
          const { fromToken, toToken, amountUSD, reason } = decision;
          console.log(`[MentoGuard] Swap: ${fromToken}→${toToken} $${amountUSD.toFixed(2)} — ${reason}`);

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
              console.warn(`[MentoGuard] Swap skipped — insufficient ${fromToken} balance ($${maxAvailable.toFixed(2)})`);
              continue;
            }
            try {
              const txHash = await executeSwap(
                { ...swap, amountUSD: cappedAmount },
                userConfig.smartAccount,
                userConfig.rules
              );
              totalTrades++;
              console.log(`[MentoGuard] Swap confirmed: ${txHash}`);
              await sendTelegramMessage(
                userConfig.telegramChatId,
                `🔄 Rebalance executed\n\n${fromToken} → ${toToken} $${cappedAmount.toFixed(2)}\n\nTx: ${txHash}`
              );
            } catch (swapErr) {
              const errMsg = (swapErr as Error).message ?? "";
              const isOracleStale = errMsg.includes("no valid median") || errMsg.includes("oracle stale");
              console.warn(`[MentoGuard] Swap failed:`, swapErr);
              if (!isOracleStale) {
                await sendTelegramMessage(
                  userConfig.telegramChatId,
                  `⚠️ Rebalance attempted but failed\n\n${reason}`
                );
              } else {
                console.log(`[MentoGuard] Oracle stale for ${fromToken}→${toToken} — skipping alert, will retry next tick`);
              }
            }
          }

        } else if (decision.action === "deposit_to_aave" || decision.action === "withdraw_from_aave") {
          const { token, amountUSD, reason } = decision as { token: string; amountUSD: number; reason: string };
          const tokenAddress = result.balances.find(b => b.token === token)?.address as `0x${string}` | undefined;
          if (!tokenAddress) { console.warn(`[MentoGuard] Unknown token for Aave: ${token}`); continue; }
          try {
            const txHash = decision.action === "deposit_to_aave"
              ? await depositToAave(tokenAddress, amountUSD, token)
              : await withdrawFromAave(tokenAddress, amountUSD, token);
            totalTrades++;
            const emoji = decision.action === "deposit_to_aave" ? "🏦" : "💸";
            const verb = decision.action === "deposit_to_aave" ? "Deposited to Aave" : "Withdrawn from Aave";
            await sendTelegramMessage(
              userConfig.telegramChatId,
              `${emoji} ${verb}\n\n${token} $${amountUSD.toFixed(2)} — ${reason}\n\nTx: ${txHash}`
            );
          } catch (err) {
            console.warn(`[MentoGuard] Aave ${decision.action} failed:`, err);
          }

        } else if (decision.action === "send_alert") {
          const emoji = decision.severity === "critical" ? "🚨" : decision.severity === "warning" ? "⚠️" : "ℹ️";
          await sendTelegramMessage(
            userConfig.telegramChatId,
            `${emoji} ${decision.message}`
          );

        } else {
          // hold
          console.log(`[MentoGuard] Holding — ${decision.reason}`);
        }
      }

      // Auto-deploy idle stablecoins to Aave only when portfolio is balanced
      // Gated on !shouldRebalance so funds stay in Aave long enough to earn yield —
      // depositing during drift would just trigger an immediate withdraw on the next swap
      const AAVE_TOKENS = ["cUSD", "cEUR"] as const;
      const MIN_DEPOSIT_USD = 0.50;
      if (!result.shouldRebalance) for (const token of AAVE_TOKENS) {
        const balance = result.balances.find(b => b.token === token);
        const walletBalanceUSD = balance?.balanceUSD ?? 0;
        const aaveBalanceUSD = aavePositions[token] ?? 0;
        // Only deposit if wallet holds more than Aave (funds actually idle)
        const idleUSD = walletBalanceUSD - aaveBalanceUSD;
        if (idleUSD >= MIN_DEPOSIT_USD) {
          const depositUSD = idleUSD * 0.8; // deploy 80%, keep 20% liquid for gas/swaps
          const tokenAddress = balance?.address as `0x${string}` | undefined;
          if (!tokenAddress) continue;
          try {
            console.log(`[MentoGuard] Auto-deploying $${depositUSD.toFixed(2)} ${token} idle balance to Aave`);
            const txHash = await depositToAave(tokenAddress, depositUSD, token);
            totalTrades++;
            aavePositions[token] = aaveBalanceUSD + depositUSD; // update local state
            await sendTelegramMessage(
              userConfig.telegramChatId,
              `🏦 Yield deployed\n\n${token} $${depositUSD.toFixed(2)} → Aave V3\n\nTx: ${txHash}`
            );
          } catch (err) {
            console.warn(`[MentoGuard] Auto-deposit ${token} failed:`, err);
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
      console.error("[MentoGuard] Tick error:", err);
    }
  });

  console.log(`[MentoGuard] Running — Hermes decides every ${MONITOR_INTERVAL_SECONDS}s`);
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
  console.log("[MentoGuard] Agent stopped.");
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  startAgent().catch(console.error);
}
