/**
 * GetRules.cdc — Script to read delegation rules from a FlowVault account
 *
 * Usage:
 *   flow scripts execute cadence/scripts/GetRules.cdc <CONTRACT_ADDRESS>
 *
 * Returns the current rules snapshot including pause state and daily volume.
 */

import DelegationRules from "../DelegationRules.cdc"

access(all) fun main(contractAddress: Address): DelegationRules.RulesSnapshot? {
    // In a full deployment, rules would be stored in the account's storage
    // This script provides a template for reading rules from the contract
    return nil
}
