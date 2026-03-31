// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/DelegationRules.sol";
import "../src/AgentRegistry.sol";
import "../src/MentoGuardAccount.sol";

contract MentoGuardAccountTest is Test {
    DelegationRules rules;
    AgentRegistry registry;
    MentoGuardAccount account;

    address owner = address(0xA11CE);
    address agent = address(0xA6E47);
    address cUSD = address(0x765DE816845861e75A25fCA122bb6898B8B1282a);
    address cEUR = address(0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73);
    address dex = address(0x5615CDAb10dc425a742d643d949a7F474C01abc4);

    function setUp() public {
        rules = new DelegationRules();
        registry = new AgentRegistry();

        vm.prank(owner);
        account = new MentoGuardAccount(owner, address(rules));

        vm.prank(owner);
        account.authorizeAgent(agent);

        // Set up rules for owner
        address[] memory tokens = new address[](2);
        tokens[0] = cUSD;
        tokens[1] = cEUR;

        address[] memory dexes = new address[](1);
        dexes[0] = dex;

        DelegationRules.Rules memory r = DelegationRules.Rules({
            maxSwapAmountUSD: 500e18,
            maxDailyVolumeUSD: 2000e18,
            allowedTokens: tokens,
            allowedDexes: dexes,
            timeWindowStart: 0,
            timeWindowEnd: 24,
            requireHumanApprovalAbove: 1000e18
        });

        vm.prank(owner);
        rules.setRules(r);
    }

    function test_AgentAuthorized() public view {
        assertEq(account.agent(), agent);
    }

    function test_ValidSwapPassesRules() public {
        // Should not revert for a valid swap under $500
        rules.validateSwap(owner, cUSD, cEUR, dex, 100e18);
    }

    function test_SwapExceedsMaxReverts() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                DelegationRules.ExceedsMaxSwapAmount.selector,
                600e18,
                500e18
            )
        );
        rules.validateSwap(owner, cUSD, cEUR, dex, 600e18);
    }

    function test_DisallowedTokenReverts() public {
        address randomToken = address(0xBEEF);
        vm.expectRevert(
            abi.encodeWithSelector(DelegationRules.TokenNotAllowed.selector, randomToken)
        );
        rules.validateSwap(owner, randomToken, cEUR, dex, 100e18);
    }

    function test_AgentRegistration() public {
        string[] memory caps = new string[](2);
        caps[0] = "fx-hedging";
        caps[1] = "stablecoin-rebalancing";

        vm.prank(agent);
        registry.register("MentoGuard", "1.0.0", "mentoguard.agent.eth", caps);

        assertEq(registry.totalAgents(), 1);
        assertEq(registry.getCapabilities(agent)[0], "fx-hedging");
    }
}
