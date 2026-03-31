/**
 * TreasuryAccount.cdc — FlowVault Smart Account
 *
 * Cadence rewrite of MentoGuardAccount.sol.
 * The DAO treasury account that the AI agent operates through.
 * Emits AgentDecision events with plain-English reasoning for every action —
 * creating a permanent, auditable on-chain decision log.
 *
 * Flow Future of Finance Hackathon — FlowVault
 */

import DelegationRules from "./DelegationRules.cdc"

access(all) contract TreasuryAccount {

    // ─── Events ───────────────────────────────────────────────────────────────

    /// Emitted after every agent action — the core audit trail
    access(all) event AgentDecision(
        action: String,           // "execute_swap" | "reserve_expense" | "hold" | "deposit_to_yield" | "withdraw_from_yield" | "send_alert"
        fromToken: String,
        toToken: String,
        amountUSD: UFix64,
        reasoning: String,        // Hermes's 1-2 sentence explanation
        txHash: String,
        timestamp: UFix64
    )

    access(all) event AgentAuthorized(agent: Address)
    access(all) event AgentRevoked(agent: Address)
    access(all) event AccountPaused(by: Address)
    access(all) event AccountResumed(by: Address)

    // ─── Storage paths ────────────────────────────────────────────────────────

    access(all) let AccountStoragePath: StoragePath
    access(all) let AccountPublicPath: PublicPath

    // ─── Account Resource ─────────────────────────────────────────────────────

    access(all) resource Treasury {
        access(all) let treasuryOwner: Address
        access(all) var agent: Address?               // authorized AI agent address
        access(all) var rules: @DelegationRules.Rules? // embedded delegation rules
        access(all) var paused: Bool
        access(all) var nonce: UInt64
        access(all) var totalTrades: UInt64
        access(all) var totalVolumeUSD: UFix64
        access(all) let createdAt: UFix64

        init(treasuryOwner: Address) {
            self.treasuryOwner = treasuryOwner
            self.agent = nil
            self.rules <- nil
            self.paused = false
            self.nonce = 0
            self.totalTrades = 0
            self.totalVolumeUSD = 0.0
            self.createdAt = getCurrentBlock().timestamp
        }

        // ─── Owner Functions ────────────────────────────────────────────

        /// Authorize an AI agent to operate this treasury
        access(all) fun authorizeAgent(agent: Address) {
            self.agent = agent
            emit AgentAuthorized(agent: agent)
        }

        /// Revoke agent authorization
        access(all) fun revokeAgent() {
            let agent = self.agent ?? panic("No agent authorized")
            self.agent = nil
            emit AgentRevoked(agent: agent)
        }

        /// Set delegation rules
        access(all) fun setRules(rules: @DelegationRules.Rules) {
            let old <- self.rules <- rules
            destroy old
        }

        /// Pause/resume the account
        access(all) fun setPaused(_ paused: Bool, by: Address) {
            self.paused = paused
            if paused {
                emit AccountPaused(by: by)
            } else {
                emit AccountResumed(by: by)
            }
        }

        // ─── Agent Execution ────────────────────────────────────────────

        /// Record a swap execution by the agent.
        /// Validates against delegation rules first, then emits the decision event.
        access(all) fun recordSwap(
            fromToken: String,
            toToken: String,
            fromTokenAddress: Address,
            toTokenAddress: Address,
            dex: Address,
            amountUSD: UFix64,
            reasoning: String,
            txHash: String
        ) {
            pre {
                !self.paused: "Account is paused"
                self.agent != nil: "No agent authorized"
            }

            // Validate against on-chain delegation rules
            if let rulesRef = &self.rules as &DelegationRules.Rules? {
                rulesRef.validateSwap(
                    fromToken: fromTokenAddress,
                    toToken: toTokenAddress,
                    dex: dex,
                    amountUSD: amountUSD
                )
            }

            self.nonce = self.nonce + 1
            self.totalTrades = self.totalTrades + 1
            self.totalVolumeUSD = self.totalVolumeUSD + amountUSD

            // Emit the permanent on-chain decision log
            emit AgentDecision(
                action: "execute_swap",
                fromToken: fromToken,
                toToken: toToken,
                amountUSD: amountUSD,
                reasoning: reasoning,
                txHash: txHash,
                timestamp: getCurrentBlock().timestamp
            )
        }

        /// Record a non-swap agent decision (hold, alert, yield, reserve)
        access(all) fun recordDecision(
            action: String,
            token: String,
            amountUSD: UFix64,
            reasoning: String
        ) {
            pre {
                !self.paused: "Account is paused"
            }

            emit AgentDecision(
                action: action,
                fromToken: token,
                toToken: "",
                amountUSD: amountUSD,
                reasoning: reasoning,
                txHash: "",
                timestamp: getCurrentBlock().timestamp
            )
        }

        // ─── Getters ────────────────────────────────────────────────────

        access(all) fun getStats(): {String: AnyStruct} {
            return {
                "owner": self.treasuryOwner,
                "agent": self.agent,
                "paused": self.paused,
                "nonce": self.nonce,
                "totalTrades": self.totalTrades,
                "totalVolumeUSD": self.totalVolumeUSD,
                "createdAt": self.createdAt
            }
        }

        // Destructors are implicitly handled in Cadence 1.0
    }

    // ─── Contract Functions ───────────────────────────────────────────────────

    /// Create a new Treasury resource
    access(all) fun createAccount(owner: Address): @Treasury {
        return <- create Treasury(treasuryOwner: owner)
    }

    init() {
        self.AccountStoragePath = /storage/FlowVaultAccount
        self.AccountPublicPath = /public/FlowVaultAccount
    }
}
