/**
 * ExpenseReserve.cdc — DAO Runway Protection
 *
 * Ring-fences stablecoins for upcoming DAO expenses (payroll, grants, protocol fees)
 * before any rebalancing can touch them. The AI agent calls lock() to reserve funds,
 * and the DAO admin calls release() when the payment is made.
 *
 * Every reservation emits an event with a plain-English reason — creating a
 * permanent on-chain audit trail of why funds were reserved.
 *
 * Flow Future of Finance Hackathon — FlowVault
 */

access(all) contract ExpenseReserve {

    // ─── Events ───────────────────────────────────────────────────────────────

    access(all) event ExpenseLocked(
        id: UInt64,
        token: String,
        amountUSD: UFix64,
        reason: String,
        dueDate: UFix64,
        lockedAt: UFix64
    )

    access(all) event ExpenseReleased(
        id: UInt64,
        token: String,
        amountUSD: UFix64,
        releasedBy: Address,
        releasedAt: UFix64
    )

    access(all) event ExpenseCancelled(
        id: UInt64,
        reason: String,
        cancelledAt: UFix64
    )

    // ─── Expense Entry ────────────────────────────────────────────────────────

    access(all) struct Expense {
        access(all) let id: UInt64
        access(all) let description: String
        access(all) let token: String              // "USDC" | "USDT"
        access(all) let amountUSD: UFix64
        access(all) let dueDate: UFix64            // unix timestamp
        access(all) let lockedAt: UFix64
        access(all) var released: Bool
        access(all) var releasedAt: UFix64?

        init(
            id: UInt64,
            description: String,
            token: String,
            amountUSD: UFix64,
            dueDate: UFix64
        ) {
            self.id = id
            self.description = description
            self.token = token
            self.amountUSD = amountUSD
            self.dueDate = dueDate
            self.lockedAt = getCurrentBlock().timestamp
            self.released = false
            self.releasedAt = nil
        }

        access(all) fun markReleased() {
            self.released = true
            self.releasedAt = getCurrentBlock().timestamp
        }
    }

    // ─── Reserve Resource ─────────────────────────────────────────────────────

    access(all) resource Reserve {
        access(all) var expenses: {UInt64: Expense}
        access(all) var nextId: UInt64
        access(all) var totalReservedUSD: UFix64
        access(all) let treasuryOwner: Address

        init(treasuryOwner: Address) {
            self.expenses = {}
            self.nextId = 1
            self.totalReservedUSD = 0.0
            self.treasuryOwner = treasuryOwner
        }

        /// Lock stablecoins for an upcoming DAO expense.
        /// Called by the AI agent via the reserve_expense tool.
        access(all) fun lock(
            token: String,
            amountUSD: UFix64,
            reason: String,
            dueDate: UFix64
        ): UInt64 {
            pre {
                token == "USDC" || token == "USDT": "Only stablecoins can be reserved"
                amountUSD > 0.0: "Amount must be positive"
                dueDate > getCurrentBlock().timestamp: "Due date must be in the future"
            }

            let id = self.nextId
            self.nextId = self.nextId + 1

            let expense = Expense(
                id: id,
                description: reason,
                token: token,
                amountUSD: amountUSD,
                dueDate: dueDate
            )

            self.expenses[id] = expense
            self.totalReservedUSD = self.totalReservedUSD + amountUSD

            emit ExpenseLocked(
                id: id,
                token: token,
                amountUSD: amountUSD,
                reason: reason,
                dueDate: dueDate,
                lockedAt: getCurrentBlock().timestamp
            )

            return id
        }

        /// Release a reserved expense (payment has been made).
        /// Called by the DAO admin after the expense is paid.
        access(all) fun release(id: UInt64, by: Address) {
            pre {
                self.expenses[id] != nil: "Expense not found"
            }

            let expense = self.expenses[id]!
            assert(!expense.released, message: "Expense already released")

            // Use a new mutable copy
            var mutableExpense = expense
            mutableExpense.markReleased()
            self.expenses[id] = mutableExpense

            self.totalReservedUSD = self.totalReservedUSD - expense.amountUSD

            emit ExpenseReleased(
                id: id,
                token: expense.token,
                amountUSD: expense.amountUSD,
                releasedBy: by,
                releasedAt: getCurrentBlock().timestamp
            )
        }

        /// Cancel a reserved expense.
        access(all) fun cancel(id: UInt64, reason: String) {
            pre {
                self.expenses[id] != nil: "Expense not found"
            }

            let expense = self.expenses[id]!
            assert(!expense.released, message: "Cannot cancel released expense")

            self.totalReservedUSD = self.totalReservedUSD - expense.amountUSD
            self.expenses.remove(key: id)

            emit ExpenseCancelled(
                id: id,
                reason: reason,
                cancelledAt: getCurrentBlock().timestamp
            )
        }

        /// Get all upcoming (unreleased) expenses
        access(all) fun getUpcoming(): [Expense] {
            let upcoming: [Expense] = []
            for id in self.expenses.keys {
                let expense = self.expenses[id]!
                if !expense.released {
                    upcoming.append(expense)
                }
            }
            return upcoming
        }

        /// Get total reserved USD for a specific token
        access(all) fun getReservedForToken(token: String): UFix64 {
            var total: UFix64 = 0.0
            for id in self.expenses.keys {
                let expense = self.expenses[id]!
                if !expense.released && expense.token == token {
                    total = total + expense.amountUSD
                }
            }
            return total
        }

        /// Get expenses due within N days
        access(all) fun getDueWithinDays(days: UFix64): [Expense] {
            let cutoff = getCurrentBlock().timestamp + (days * 86400.0)
            let dueExpenses: [Expense] = []
            for id in self.expenses.keys {
                let expense = self.expenses[id]!
                if !expense.released && expense.dueDate <= cutoff {
                    dueExpenses.append(expense)
                }
            }
            return dueExpenses
        }
    }

    // ─── Contract Functions ───────────────────────────────────────────────────

    /// Create a new ExpenseReserve resource for a DAO treasury
    access(all) fun createReserve(owner: Address): @Reserve {
        return <- create Reserve(treasuryOwner: owner)
    }
}
