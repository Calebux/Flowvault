// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/FlowVaultRules.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        new FlowVaultRules(
            0x0067378592A4d0ccC3146dBa13137E21589921Ed, // agent wallet
            50000,  // maxSwapAmountUSD ($500.00)
            200000, // maxDailyVolumeUSD ($2000.00)
            5       // driftThreshold (5%)
        );
        vm.stopBroadcast();
    }
}
