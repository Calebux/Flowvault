/**
 * DAOMultiSig.cdc — Multi-Signature Approval for Large Rebalances
 *
 * Rebalances above a configurable USD threshold require 2-of-3 approval
 * from designated DAO signers before the agent can execute.
 *
 * Flow:
 *   1. Agent proposes a large swap → creates PendingApproval
 *   2. Signers are notified via Telegram
 *   3. 2 of 3 signers call approve() within 24h
 *   4. Agent's next tick detects approval and executes the swap
 *   5. If 24h expires without quorum → auto-cancelled, alert sent
 *
 * Flow Future of Finance Hackathon — FlowVault
 */

access(all) contract DAOMultiSig {

    // ─── Events ───────────────────────────────────────────────────────────────

    access(all) event ProposalCreated(
        id: UInt64,
        fromToken: String,
        toToken: String,
        amountUSD: UFix64,
        reasoning: String,
        expiresAt: UFix64
    )

    access(all) event ProposalApproved(
        id: UInt64,
        signer: Address,
        approvalsCount: UInt8
    )

    access(all) event ProposalExecuted(
        id: UInt64,
        amountUSD: UFix64
    )

    access(all) event ProposalCancelled(
        id: UInt64,
        reason: String
    )

    access(all) event SignerAdded(signer: Address)
    access(all) event SignerRemoved(signer: Address)

    // ─── Proposal Struct ──────────────────────────────────────────────────────

    access(all) enum ProposalStatus: UInt8 {
        access(all) case pending
        access(all) case approved
        access(all) case executed
        access(all) case cancelled
        access(all) case expired
    }

    access(all) struct Proposal {
        access(all) let id: UInt64
        access(all) let fromToken: String
        access(all) let toToken: String
        access(all) let amountUSD: UFix64
        access(all) let reasoning: String
        access(all) let createdAt: UFix64
        access(all) let expiresAt: UFix64         // 24h from creation
        access(all) var approvals: [Address]
        access(all) var status: ProposalStatus

        init(
            id: UInt64,
            fromToken: String,
            toToken: String,
            amountUSD: UFix64,
            reasoning: String
        ) {
            self.id = id
            self.fromToken = fromToken
            self.toToken = toToken
            self.amountUSD = amountUSD
            self.reasoning = reasoning
            self.createdAt = getCurrentBlock().timestamp
            self.expiresAt = getCurrentBlock().timestamp + 86400.0  // 24 hours
            self.approvals = []
            self.status = ProposalStatus.pending
        }

        access(all) fun addApproval(signer: Address) {
            self.approvals.append(signer)
        }

        access(all) fun setStatus(_ status: ProposalStatus) {
            self.status = status
        }
    }

    // ─── MultiSig Resource ────────────────────────────────────────────────────

    access(all) resource MultiSig {
        access(all) var signers: [Address]         // authorized signers
        access(all) var requiredApprovals: UInt8    // quorum (default: 2)
        access(all) var threshold: UFix64           // USD amount requiring multi-sig
        access(all) var proposals: {UInt64: Proposal}
        access(all) var nextProposalId: UInt64
        access(all) let treasuryOwner: Address

        init(
            treasuryOwner: Address,
            signers: [Address],
            requiredApprovals: UInt8,
            threshold: UFix64
        ) {
            pre {
                signers.length >= Int(requiredApprovals):
                    "Need at least as many signers as required approvals"
                requiredApprovals > 0: "Required approvals must be > 0"
            }
            self.treasuryOwner = treasuryOwner
            self.signers = signers
            self.requiredApprovals = requiredApprovals
            self.threshold = threshold
            self.proposals = {}
            self.nextProposalId = 1
        }

        // ─── Proposal Lifecycle ─────────────────────────────────────────

        /// Create a pending approval for a large swap.
        /// Called by the agent when amountUSD > threshold.
        access(all) fun propose(
            fromToken: String,
            toToken: String,
            amountUSD: UFix64,
            reasoning: String
        ): UInt64 {
            pre {
                amountUSD > self.threshold:
                    "Amount does not exceed threshold — no approval needed"
            }

            let id = self.nextProposalId
            self.nextProposalId = self.nextProposalId + 1

            let proposal = Proposal(
                id: id,
                fromToken: fromToken,
                toToken: toToken,
                amountUSD: amountUSD,
                reasoning: reasoning
            )

            self.proposals[id] = proposal

            emit ProposalCreated(
                id: id,
                fromToken: fromToken,
                toToken: toToken,
                amountUSD: amountUSD,
                reasoning: reasoning,
                expiresAt: proposal.expiresAt
            )

            return id
        }

        /// Approve a pending proposal. Called by authorized signers.
        access(all) fun approve(id: UInt64, signer: Address) {
            pre {
                self.proposals[id] != nil: "Proposal not found"
                self.signers.contains(signer): "Not an authorized signer"
            }

            var proposal = self.proposals[id]!

            assert(
                proposal.status == ProposalStatus.pending,
                message: "Proposal is not pending"
            )
            assert(
                getCurrentBlock().timestamp < proposal.expiresAt,
                message: "Proposal has expired"
            )
            assert(
                !proposal.approvals.contains(signer),
                message: "Signer has already approved"
            )

            proposal.addApproval(signer: signer)

            // Check if quorum is reached
            if UInt8(proposal.approvals.length) >= self.requiredApprovals {
                proposal.setStatus(ProposalStatus.approved)
            }

            self.proposals[id] = proposal

            emit ProposalApproved(
                id: id,
                signer: signer,
                approvalsCount: UInt8(proposal.approvals.length)
            )
        }

        /// Mark a proposal as executed. Called after the agent performs the swap.
        access(all) fun markExecuted(id: UInt64) {
            pre {
                self.proposals[id] != nil: "Proposal not found"
            }

            var proposal = self.proposals[id]!
            assert(
                proposal.status == ProposalStatus.approved,
                message: "Proposal is not approved"
            )

            proposal.setStatus(ProposalStatus.executed)
            self.proposals[id] = proposal

            emit ProposalExecuted(id: id, amountUSD: proposal.amountUSD)
        }

        /// Cancel a pending proposal.
        access(all) fun cancel(id: UInt64, reason: String) {
            pre {
                self.proposals[id] != nil: "Proposal not found"
            }

            var proposal = self.proposals[id]!
            assert(
                proposal.status == ProposalStatus.pending,
                message: "Can only cancel pending proposals"
            )

            proposal.setStatus(ProposalStatus.cancelled)
            self.proposals[id] = proposal

            emit ProposalCancelled(id: id, reason: reason)
        }

        /// Check and expire any proposals past their 24h deadline.
        /// Called by the agent on each tick.
        access(all) fun expireStale() {
            let now = getCurrentBlock().timestamp
            for id in self.proposals.keys {
                var proposal = self.proposals[id]!
                if proposal.status == ProposalStatus.pending && now >= proposal.expiresAt {
                    proposal.setStatus(ProposalStatus.expired)
                    self.proposals[id] = proposal
                    emit ProposalCancelled(
                        id: id,
                        reason: "Expired — no quorum reached within 24h"
                    )
                }
            }
        }

        // ─── Queries ────────────────────────────────────────────────────

        /// Check if a proposal has been approved and is ready for execution
        access(all) fun isApproved(id: UInt64): Bool {
            if let proposal = self.proposals[id] {
                return proposal.status == ProposalStatus.approved
            }
            return false
        }

        /// Get all pending proposals
        access(all) fun getPending(): [Proposal] {
            let pendingProposals: [Proposal] = []
            for id in self.proposals.keys {
                let proposal = self.proposals[id]!
                if proposal.status == ProposalStatus.pending {
                    pendingProposals.append(proposal)
                }
            }
            return pendingProposals
        }

        // ─── Admin ──────────────────────────────────────────────────────

        access(all) fun addSigner(signer: Address) {
            pre {
                !self.signers.contains(signer): "Already a signer"
            }
            self.signers.append(signer)
            emit SignerAdded(signer: signer)
        }

        access(all) fun removeSigner(signer: Address) {
            pre {
                self.signers.contains(signer): "Not a signer"
                self.signers.length > Int(self.requiredApprovals):
                    "Cannot remove — would drop below required approvals"
            }
            var idx = 0
            while idx < self.signers.length {
                if self.signers[idx] == signer {
                    self.signers.remove(at: idx)
                    break
                }
                idx = idx + 1
            }
            emit SignerRemoved(signer: signer)
        }

        access(all) fun setThreshold(threshold: UFix64) {
            self.threshold = threshold
        }
    }

    // ─── Contract Functions ───────────────────────────────────────────────────

    /// Create a new MultiSig resource for a DAO treasury
    access(all) fun createMultiSig(
        owner: Address,
        signers: [Address],
        requiredApprovals: UInt8,
        threshold: UFix64
    ): @MultiSig {
        return <- create MultiSig(
            treasuryOwner: owner,
            signers: signers,
            requiredApprovals: requiredApprovals,
            threshold: threshold
        )
    }
}
