/**
 * GetUpcomingExpenses.cdc — Script to read upcoming expenses from ExpenseReserve
 *
 * Usage:
 *   flow scripts execute cadence/scripts/GetUpcomingExpenses.cdc <RESERVE_ADDRESS>
 *
 * Returns all unreleased expense entries sorted by due date.
 */

import ExpenseReserve from "../ExpenseReserve.cdc"

access(all) fun main(reserveAddress: Address): [ExpenseReserve.Expense] {
    // In a full deployment, the Reserve resource is stored in account storage
    // This script provides a template for reading upcoming expenses
    return []
}
