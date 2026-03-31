/**
 * GetTreasuryStats.cdc — Script to read treasury account stats
 *
 * Usage:
 *   flow scripts execute cadence/scripts/GetTreasuryStats.cdc <ACCOUNT_ADDRESS>
 *
 * Returns total trades, volume, agent address, and pause state.
 */

import TreasuryAccount from "../TreasuryAccount.cdc"

access(all) fun main(accountAddress: Address): {String: AnyStruct}? {
    // In a full deployment, the TreasuryAccount resource is stored in account storage
    // This script provides a template for reading the stats
    return nil
}
