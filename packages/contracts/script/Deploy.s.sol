// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/DelegationRules.sol";
import "../src/AgentRegistry.sol";
import "../src/FlowVaultAccount.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("FLOW_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // 1. Deploy DelegationRules
        DelegationRules rules = new DelegationRules();
        console.log("DelegationRules:", address(rules));

        // 2. Deploy AgentRegistry
        AgentRegistry registry = new AgentRegistry();
        console.log("AgentRegistry:", address(registry));

        // 3. Deploy FlowVaultAccount for deployer
        FlowVaultAccount account = new FlowVaultAccount(deployer, address(rules));
        console.log("FlowVaultAccount:", address(account));

        vm.stopBroadcast();

        console.log("\n=== Deployment Complete ===");
        console.log("Update .env with:");
        console.log("  DELEGATION_RULES_ADDRESS=", address(rules));
        console.log("  FLOW_SMART_ACCOUNT_ADDRESS=", address(account));
    }
}
