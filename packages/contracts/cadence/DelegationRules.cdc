/**
 * DelegationRules.cdc — FlowVault Onchain Guardrails
 *
 * Enforces 6 delegation rules for the FlowVault autonomous treasury agent.
 * These rules are checked on-chain — the agent CANNOT exceed them even if
 * the backend is compromised.
 *
 * Cadence resource-oriented design: assets are resources, not just numbers.
 * The rules are enforced by the type system before the transaction commits.
 *
 * Flow Future of Finance Hackathon — FlowVault
 */

access(all) contract DelegationRules {

    // ─── Events ───────────────────────────────────────────────────────────────

    access(all) event RulesUpdated(
        owner: Address,
        maxSwapAmountUSD: UFix64,
        maxDailyVolumeUSD: UFix64,
        timeWindowStart: UInt8,
        timeWindowEnd: UInt8,
        requireApprovalAbove: UFix64
    )

    access(all) event SwapValidated(
        owner: Address,
        fromToken: Address,
        toToken: Address,
        amountUSD: UFix64
    )

    access(all) event SwapRejected(
        owner: Address,
        reason: String,
        amountUSD: UFix64
    )

    // ─── Rule Resource ────────────────────────────────────────────────────────

    access(all) resource Rules {
        access(all) var maxSwapAmountUSD: UFix64        // Max single swap in USD
        access(all) var maxDailyVolumeUSD: UFix64       // Rolling 24h volume cap
        access(all) var allowedTokens: [Address]        // Whitelist of token addresses
        access(all) var allowedDexes: [Address]         // Whitelist of DEX router addresses
        access(all) var timeWindowStart: UInt8          // UTC hour (0–23)
        access(all) var timeWindowEnd: UInt8            // UTC hour (0–23)
        access(all) var requireApprovalAbove: UFix64    // Multi-sig threshold in USD
        access(all) var paused: Bool                    // Emergency pause
        access(all) var driftThreshold: UInt8           // Drift % threshold
        access(all) var dailyVolumeUsed: UFix64         // Today's volume
        access(all) var lastVolumeReset: UFix64         // Timestamp of last reset
        access(all) var updatedAt: UFix64               // Last update timestamp

        init(
            maxSwapAmountUSD: UFix64,
            maxDailyVolumeUSD: UFix64,
            allowedTokens: [Address],
            allowedDexes: [Address],
            timeWindowStart: UInt8,
            timeWindowEnd: UInt8,
            requireApprovalAbove: UFix64,
            driftThreshold: UInt8
        ) {
            self.maxSwapAmountUSD = maxSwapAmountUSD
            self.maxDailyVolumeUSD = maxDailyVolumeUSD
            self.allowedTokens = allowedTokens
            self.allowedDexes = allowedDexes
            self.timeWindowStart = timeWindowStart
            self.timeWindowEnd = timeWindowEnd
            self.requireApprovalAbove = requireApprovalAbove
            self.paused = false
            self.driftThreshold = driftThreshold
            self.dailyVolumeUsed = 0.0
            self.lastVolumeReset = getCurrentBlock().timestamp
            self.updatedAt = getCurrentBlock().timestamp
        }

        // Update rules — only callable by the resource owner
        access(all) fun updateRules(
            maxSwapAmountUSD: UFix64,
            maxDailyVolumeUSD: UFix64,
            allowedTokens: [Address],
            allowedDexes: [Address],
            timeWindowStart: UInt8,
            timeWindowEnd: UInt8,
            requireApprovalAbove: UFix64,
            driftThreshold: UInt8
        ) {
            self.maxSwapAmountUSD = maxSwapAmountUSD
            self.maxDailyVolumeUSD = maxDailyVolumeUSD
            self.allowedTokens = allowedTokens
            self.allowedDexes = allowedDexes
            self.timeWindowStart = timeWindowStart
            self.timeWindowEnd = timeWindowEnd
            self.requireApprovalAbove = requireApprovalAbove
            self.driftThreshold = driftThreshold
            self.updatedAt = getCurrentBlock().timestamp
        }

        access(all) fun setPaused(_ paused: Bool) {
            self.paused = paused
            self.updatedAt = getCurrentBlock().timestamp
        }

        // ─── Validation ────────────────────────────────────────────────────

        /// Validate a proposed swap against all 6 delegation rules.
        /// Panics (reverts the entire transaction) if any rule is violated.
        access(all) fun validateSwap(
            fromToken: Address,
            toToken: Address,
            dex: Address,
            amountUSD: UFix64
        ) {
            // 0. Pause check
            assert(!self.paused, message: "Agent is paused — no swaps allowed")

            // 1. Max single swap amount
            assert(
                amountUSD <= self.maxSwapAmountUSD,
                message: "Exceeds max single swap: "
                    .concat(amountUSD.toString())
                    .concat(" > ")
                    .concat(self.maxSwapAmountUSD.toString())
            )

            // 2. Daily volume — reset if new day
            let dayStart = getCurrentBlock().timestamp - (getCurrentBlock().timestamp % 86400.0)
            if self.lastVolumeReset < dayStart {
                self.dailyVolumeUsed = 0.0
                self.lastVolumeReset = dayStart
            }
            let newDailyTotal = self.dailyVolumeUsed + amountUSD
            assert(
                newDailyTotal <= self.maxDailyVolumeUSD,
                message: "Exceeds daily volume cap: "
                    .concat(newDailyTotal.toString())
                    .concat(" > ")
                    .concat(self.maxDailyVolumeUSD.toString())
            )

            // 3. Token whitelist
            assert(
                self.allowedTokens.contains(fromToken),
                message: "fromToken not in allowlist"
            )
            assert(
                self.allowedTokens.contains(toToken),
                message: "toToken not in allowlist"
            )

            // 4. DEX whitelist
            assert(
                self.allowedDexes.contains(dex),
                message: "DEX not in allowlist"
            )

            // 5. Time window (UTC hour)
            let hour = UInt8(getCurrentBlock().timestamp % 86400.0 / 3600.0)
            assert(
                hour >= self.timeWindowStart && hour < self.timeWindowEnd,
                message: "Outside operating hours: "
                    .concat(hour.toString())
                    .concat(" not in [")
                    .concat(self.timeWindowStart.toString())
                    .concat(", ")
                    .concat(self.timeWindowEnd.toString())
                    .concat(")")
            )

            // 6. Multi-sig approval threshold
            assert(
                amountUSD <= self.requireApprovalAbove,
                message: "Requires multi-sig approval above $"
                    .concat(self.requireApprovalAbove.toString())
            )

            // Record volume
            self.dailyVolumeUsed = newDailyTotal
        }
    }

    // ─── Public getter (scripts) ──────────────────────────────────────────────

    access(all) struct RulesSnapshot {
        access(all) let maxSwapAmountUSD: UFix64
        access(all) let maxDailyVolumeUSD: UFix64
        access(all) let driftThreshold: UInt8
        access(all) let paused: Bool
        access(all) let updatedAt: UFix64

        init(
            maxSwapAmountUSD: UFix64,
            maxDailyVolumeUSD: UFix64,
            driftThreshold: UInt8,
            paused: Bool,
            updatedAt: UFix64
        ) {
            self.maxSwapAmountUSD = maxSwapAmountUSD
            self.maxDailyVolumeUSD = maxDailyVolumeUSD
            self.driftThreshold = driftThreshold
            self.paused = paused
            self.updatedAt = updatedAt
        }
    }

    // ─── Contract helpers ─────────────────────────────────────────────────────

    /// Create a new Rules resource with default values
    access(all) fun createRules(
        maxSwapAmountUSD: UFix64,
        maxDailyVolumeUSD: UFix64,
        allowedTokens: [Address],
        allowedDexes: [Address],
        timeWindowStart: UInt8,
        timeWindowEnd: UInt8,
        requireApprovalAbove: UFix64,
        driftThreshold: UInt8
    ): @Rules {
        return <- create Rules(
            maxSwapAmountUSD: maxSwapAmountUSD,
            maxDailyVolumeUSD: maxDailyVolumeUSD,
            allowedTokens: allowedTokens,
            allowedDexes: allowedDexes,
            timeWindowStart: timeWindowStart,
            timeWindowEnd: timeWindowEnd,
            requireApprovalAbove: requireApprovalAbove,
            driftThreshold: driftThreshold
        )
    }
}
