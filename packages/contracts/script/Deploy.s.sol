// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/DelegationRules.sol";
import "../src/AgentRegistry.sol";
import "../src/MentoGuardAccount.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("CELO_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // 1. Deploy DelegationRules
        DelegationRules rules = new DelegationRules();
        console.log("DelegationRules:", address(rules));

        // 2. Deploy AgentRegistry
        AgentRegistry registry = new AgentRegistry();
        console.log("AgentRegistry:", address(registry));

        // 3. Deploy MentoGuardAccount for deployer
        MentoGuardAccount account = new MentoGuardAccount(deployer, address(rules));
        console.log("MentoGuardAccount:", address(account));

        vm.stopBroadcast();

        console.log("\n=== Deployment Complete ===");
        console.log("Update .env with:");
        console.log("  MM_DELEGATION_CONTRACT=", address(rules));
        console.log("  CELO_SMART_ACCOUNT_ADDRESS=", address(account));
    }
}
